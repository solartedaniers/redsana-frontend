use std::net::{IpAddr, Ipv4Addr};
use crate::console_command::hidden_console_command;
use std::time::Duration;

use serde::Serialize;
use surge_ping::{Client, PingIdentifier, PingSequence};
use tokio::task::JoinSet;

use crate::ping::new_client;

/// Comando nativo de Windows para leer la configuración IP de las interfaces activas.
/// "/all" agrega la dirección física (MAC) del adaptador, necesaria para contar
/// a este mismo equipo entre los dispositivos de la red.
const IPCONFIG_COMMAND: &str = "ipconfig";
const IPCONFIG_ARGS: [&str; 1] = ["/all"];
/// Etiquetas de campo (normalizadas: sin espacios/puntos, en minúsculas) para la
/// IPv4 y la máscara de subred, según el idioma de Windows.
const IPV4_ADDRESS_LABELS: [&str; 2] = ["ipv4address", "direcciónipv4"];
const SUBNET_MASK_LABELS: [&str; 2] = ["subnetmask", "máscaradesubred"];
const PHYSICAL_ADDRESS_LABELS: [&str; 2] = ["physicaladdress", "direcciónfísica"];
const DEFAULT_GATEWAY_LABELS: [&str; 2] = ["defaultgateway", "puertadeenlacepredeterminada"];

/// Palabras que delatan un adaptador virtual/túnel (WSL, Hyper-V, Docker, VPN,
/// loopback) en el encabezado de su sección de `ipconfig`. Estos adaptadores
/// casi siempre aparecen ANTES del adaptador físico real en la salida (ej.
/// "vEthernet (WSL)" antes de "Wi-Fi"), y si se toma la primera IPv4 sin
/// filtrar, el escaneo termina barriendo la subred virtual (172.20.x.x, etc.)
/// en vez de la red real -- confirmado en vivo en esta misma máquina.
const VIRTUAL_ADAPTER_MARKERS: [&str; 6] = ["virtual", "vethernet", "vpn", "tunel", "túnel", "loopback"];

/// Comando nativo de Windows para leer la tabla ARP real del sistema.
const ARP_COMMAND: &str = "arp";
const ARP_ARGS: [&str; 1] = ["-a"];
const BROADCAST_MAC: &str = "ff-ff-ff-ff-ff-ff";
const MULTICAST_MAC_PREFIX: &str = "01-00-5e";

/// Timeout corto por IP: no necesitamos una respuesta ICMP real, solo forzar
/// que el SO intente resolver la MAC por ARP (eso ocurre en la capa IP antes
/// de enviar el paquete, responda o no el destino).
const ARP_TRIGGER_TIMEOUT: Duration = Duration::from_millis(300);
/// Límite de IPs a barrer: evita un escaneo desmedido si un adaptador reporta
/// una máscara inusualmente amplia. Una LAN doméstica (/24, 254 hosts) nunca
/// lo alcanza; 4096 cubre hasta un /20, que ya es una subred plana grande
/// típica de una red corporativa/de campus. El barrido es concurrente (ver
/// scan_connected_devices), así que subir este número no multiplica el
/// tiempo del escaneo, solo su cobertura.
const MAX_HOSTS_TO_SCAN: usize = 4096;
/// Espera tras cada pasada del barrido. Un celular en ahorro de energía solo
/// atiende la radio en sus ventanas de despertar (cientos de ms a ~1s), así que
/// contesta el ARP tarde: con una sola pasada y lectura inmediata de la tabla
/// ARP quedaba fuera (confirmado en vivo: un escaneo vio solo el router y los
/// siguientes vieron también el celular).
const SWEEP_SETTLE_DELAY: Duration = Duration::from_millis(1000);
const SWEEP_PASSES: usize = 2;

/// Papel del dispositivo en la red: el router (puerta de enlace) es la red
/// misma y este equipo no aparece en su propia tabla ARP; ambos se marcan para
/// que la interfaz no los confunda con "otros dispositivos conectados".
#[derive(Serialize, Clone, Copy, Debug, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum DeviceRole {
    ThisDevice,
    Gateway,
    Other,
}

/// Dispositivo descubierto por ARP: solo IP y MAC, el nombre casi nunca está
/// disponible por este medio y no debe inventarse (queda a cargo del backend/UI).
#[derive(Serialize, Clone, Debug)]
pub struct DiscoveredDevice {
    pub ip: String,
    pub mac: String,
    pub role: DeviceRole,
}

/// Configuración del adaptador físico activo, leída de `ipconfig /all`.
#[derive(Debug, PartialEq)]
struct LocalInterface {
    ip: Ipv4Addr,
    mask: Ipv4Addr,
    gateway: Option<Ipv4Addr>,
    mac: Option<String>,
}

/// Descubre los dispositivos realmente conectados a la LAN local: determina
/// la subred propia, fuerza su resolución ARP con un barrido concurrente, y
/// lee la tabla ARP resultante.
#[tauri::command]
pub async fn scan_connected_devices() -> Result<Vec<DiscoveredDevice>, String> {
    let interface = tokio::task::spawn_blocking(local_interface)
        .await
        .map_err(|e| format!("no se pudo determinar la subred local: {e}"))??;

    let targets = hosts_in_subnet(interface.ip, interface.mask, interface.ip);
    let client = new_client(IpAddr::V4(interface.ip))?;

    for _ in 0..SWEEP_PASSES {
        sweep_subnet(&client, &targets).await;
        tokio::time::sleep(SWEEP_SETTLE_DELAY).await;
    }

    let arp_output = tokio::task::spawn_blocking(run_arp_a)
        .await
        .map_err(|e| format!("no se pudo ejecutar arp: {e}"))??;

    Ok(classify_devices(&interface, parse_arp_table(&arp_output)))
}

/// Los pings corren en paralelo: una pasada tarda ~ARP_TRIGGER_TIMEOUT, no
/// ARP_TRIGGER_TIMEOUT * cantidad_de_hosts. El resultado de cada ping no importa.
async fn sweep_subnet(client: &Client, targets: &[Ipv4Addr]) {
    let mut sweep = JoinSet::new();
    for (sequence, ip) in targets.iter().copied().enumerate() {
        let client = client.clone();
        sweep.spawn(async move { trigger_arp_resolution(&client, ip, sequence as u16).await });
    }
    while sweep.join_next().await.is_some() {}
}

/// MAC de la puerta de enlace de la red actual: identifica la red (cada router
/// tiene la suya) para que la detección de anomalías aprenda cada red por
/// separado. Sale cruda solo hacia el frontend de este mismo equipo, que la
/// convierte en hash antes de enviarla. None si no hay red o no se pudo resolver.
#[tauri::command]
pub async fn current_gateway_mac() -> Result<Option<String>, String> {
    let interface = match tokio::task::spawn_blocking(local_interface).await {
        Ok(Ok(interface)) => interface,
        _ => return Ok(None), // sin adaptador con IPv4: no hay red que identificar
    };
    let Some(gateway) = interface.gateway else { return Ok(None) };

    if let Some(mac) = gateway_mac_from_arp(gateway).await? {
        return Ok(Some(mac));
    }
    // Entrada ARP vencida: un ping al router la vuelve a llenar.
    let client = new_client(IpAddr::V4(interface.ip))?;
    trigger_arp_resolution(&client, gateway, 0).await;
    gateway_mac_from_arp(gateway).await
}

async fn gateway_mac_from_arp(gateway: Ipv4Addr) -> Result<Option<String>, String> {
    let arp_output = tokio::task::spawn_blocking(run_arp_a)
        .await
        .map_err(|e| format!("no se pudo ejecutar arp: {e}"))??;
    Ok(find_mac_for_ip(&parse_arp_table(&arp_output), gateway))
}

fn find_mac_for_ip(neighbors: &[DiscoveredDevice], ip: Ipv4Addr) -> Option<String> {
    let ip = ip.to_string();
    neighbors.iter().find(|device| device.ip == ip).map(|device| device.mac.clone())
}

/// Deja solo los vecinos de la subred propia, marca el router y agrega este
/// mismo equipo (que nunca está en su propia tabla ARP).
fn classify_devices(interface: &LocalInterface, neighbors: Vec<DiscoveredDevice>) -> Vec<DiscoveredDevice> {
    let network = u32::from(interface.ip) & u32::from(interface.mask);
    let broadcast = network | !u32::from(interface.mask);

    let mut devices: Vec<DiscoveredDevice> = neighbors
        .into_iter()
        .filter_map(|device| {
            let ip = device.ip.parse::<Ipv4Addr>().ok()?;
            let in_subnet = ip != interface.ip && u32::from(ip) > network && u32::from(ip) < broadcast;
            let role = if Some(ip) == interface.gateway { DeviceRole::Gateway } else { DeviceRole::Other };
            in_subnet.then_some(DiscoveredDevice { role, ..device })
        })
        .collect();

    if let Some(mac) = &interface.mac {
        devices.push(DiscoveredDevice { ip: interface.ip.to_string(), mac: mac.clone(), role: DeviceRole::ThisDevice });
    }
    devices
}

fn local_interface() -> Result<LocalInterface, String> {
    let output = hidden_console_command(IPCONFIG_COMMAND)
        .args(IPCONFIG_ARGS)
        .output()
        .map_err(|e| format!("no se pudo lanzar ipconfig: {e}"))?;

    if !output.status.success() {
        return Err(format!(
            "ipconfig devolvió un error (código {:?}): {}",
            output.status.code(),
            decode_console_output(&output.stderr)
        ));
    }

    let stdout = decode_console_output(&output.stdout);
    parse_local_interface(&stdout).ok_or_else(|| {
        format!("no se encontró una IPv4 local válida en la salida de ipconfig:\n{stdout}")
    })
}

/// Busca el primer adaptador FÍSICO (no virtual/túnel) con una IPv4 real (no
/// APIPA 169.254.x.x) y su máscara asociada, junto con su MAC y su puerta de
/// enlace. No asume nombre de adaptador ni rango: los deriva del propio texto
/// de ipconfig, pero descarta secciones completas cuyo encabezado delate un
/// adaptador virtual (ver VIRTUAL_ADAPTER_MARKERS).
fn parse_local_interface(ipconfig_output: &str) -> Option<LocalInterface> {
    let mut section = SectionFields::default();
    let mut in_virtual_adapter = false;

    for line in ipconfig_output.lines() {
        if is_adapter_header(line) {
            if let Some(found) = section.into_interface() {
                return Some(found);
            }
            section = SectionFields::default();
            in_virtual_adapter = is_virtual_adapter_header(line);
            continue;
        }
        if in_virtual_adapter {
            continue;
        }

        // "Puerta de enlace" puede traer varios valores en líneas siguientes
        // sin etiqueta (primero la IPv6 y debajo la IPv4): son un solo token.
        let token = line.trim();
        if section.awaiting_gateway && !token.is_empty() && !token.contains(char::is_whitespace) {
            if let Ok(gateway) = token.parse::<Ipv4Addr>() {
                section.gateway.get_or_insert(gateway);
            }
            continue;
        }

        let Some((label, value)) = line.split_once(':') else { continue };
        let label = normalize_label(label);
        let value = value.trim();
        section.awaiting_gateway = DEFAULT_GATEWAY_LABELS.contains(&label.as_str());

        if IPV4_ADDRESS_LABELS.contains(&label.as_str()) {
            // ipconfig a veces agrega "(Preferido)"/"(Preferred)" pegado al valor.
            let ip_text = value.split('(').next().unwrap_or(value).trim();
            section.ip = ip_text.parse::<Ipv4Addr>().ok().filter(|ip| !is_link_local(*ip));
        } else if SUBNET_MASK_LABELS.contains(&label.as_str()) {
            section.mask = value.parse::<Ipv4Addr>().ok();
        } else if PHYSICAL_ADDRESS_LABELS.contains(&label.as_str()) && is_mac_shaped(value) {
            section.mac = Some(value.to_lowercase());
        } else if section.awaiting_gateway {
            section.gateway = value.parse::<Ipv4Addr>().ok();
        }
    }

    section.into_interface()
}

#[derive(Default)]
struct SectionFields {
    ip: Option<Ipv4Addr>,
    mask: Option<Ipv4Addr>,
    gateway: Option<Ipv4Addr>,
    mac: Option<String>,
    awaiting_gateway: bool,
}

impl SectionFields {
    fn into_interface(self) -> Option<LocalInterface> {
        Some(LocalInterface { ip: self.ip?, mask: self.mask?, gateway: self.gateway, mac: self.mac })
    }
}

/// Encabezado de sección de adaptador en `ipconfig`: no tiene sangría y no
/// trae valor después de los dos puntos (a diferencia de una línea de campo
/// como "   IPv4 Address. . . : 192.168.1.23"). Detectarlo por forma, no por
/// palabra ("adapter"/"adaptador"), evita depender del idioma de Windows.
fn is_adapter_header(line: &str) -> bool {
    !line.is_empty() && !line.starts_with(char::is_whitespace) && line.trim_end().ends_with(':')
}

fn is_virtual_adapter_header(line: &str) -> bool {
    let lower = line.to_lowercase();
    VIRTUAL_ADAPTER_MARKERS.iter().any(|marker| lower.contains(marker))
}

fn normalize_label(label: &str) -> String {
    label.chars().filter(|c| !c.is_whitespace() && *c != '.').collect::<String>().to_lowercase()
}

fn is_link_local(ip: Ipv4Addr) -> bool {
    ip.octets()[0] == 169 && ip.octets()[1] == 254
}

/// Direcciones host de la subred (excluye red, broadcast y la propia IP),
/// acotadas a MAX_HOSTS_TO_SCAN.
fn hosts_in_subnet(ip: Ipv4Addr, mask: Ipv4Addr, exclude: Ipv4Addr) -> Vec<Ipv4Addr> {
    let network = u32::from(ip) & u32::from(mask);
    let broadcast = network | !u32::from(mask);
    let exclude_bits = u32::from(exclude);

    if broadcast <= network + 1 {
        return Vec::new();
    }

    ((network + 1)..broadcast)
        .filter(|bits| *bits != exclude_bits)
        .take(MAX_HOSTS_TO_SCAN)
        .map(Ipv4Addr::from)
        .collect()
}

/// Envía un ping con timeout corto solo para forzar la resolución ARP del SO;
/// el resultado del ping en sí (éxito, timeout, error) es irrelevante aquí.
async fn trigger_arp_resolution(client: &Client, ip: Ipv4Addr, sequence: u16) {
    let mut pinger = client.pinger(IpAddr::V4(ip), PingIdentifier(sequence)).await;
    pinger.timeout(ARP_TRIGGER_TIMEOUT);
    let _ = pinger.ping(PingSequence(sequence), &[]).await;
}

fn run_arp_a() -> Result<String, String> {
    let output = hidden_console_command(ARP_COMMAND).args(ARP_ARGS).output().map_err(|e| format!("no se pudo lanzar arp: {e}"))?;

    if !output.status.success() {
        return Err(format!(
            "arp -a devolvió un error (código {:?}): {}",
            output.status.code(),
            decode_console_output(&output.stderr)
        ));
    }

    Ok(decode_console_output(&output.stdout))
}

/// Decodifica la salida cruda de un comando de consola de Windows (ipconfig, arp)
/// usando la página de códigos OEM realmente activa (850, 437, 866... según el
/// idioma del sistema), en vez de asumir UTF-8. `String::from_utf8_lossy` corrompe
/// silenciosamente cualquier tilde/ñ (ej. "Dirección") en locales no-inglesas,
/// lo que rompe el parseo de etiquetas sin dar ningún error visible.
#[cfg(windows)]
fn decode_console_output(bytes: &[u8]) -> String {
    use std::ptr;

    #[link(name = "kernel32")]
    extern "system" {
        fn GetOEMCP() -> u32;
        fn MultiByteToWideChar(
            code_page: u32,
            flags: u32,
            multi_byte_str: *const u8,
            cbmultibyte: i32,
            wide_char_str: *mut u16,
            cchwidechar: i32,
        ) -> i32;
    }

    if bytes.is_empty() {
        return String::new();
    }

    // ponytail: solo cubre la página de códigos activa al arrancar el proceso;
    // si el usuario la cambia en pleno vuelo (raro), habría que releer GetOEMCP cada vez.
    unsafe {
        let code_page = GetOEMCP();
        let len = MultiByteToWideChar(code_page, 0, bytes.as_ptr(), bytes.len() as i32, ptr::null_mut(), 0);
        if len <= 0 {
            return String::from_utf8_lossy(bytes).into_owned();
        }

        let mut buffer = vec![0u16; len as usize];
        let written = MultiByteToWideChar(code_page, 0, bytes.as_ptr(), bytes.len() as i32, buffer.as_mut_ptr(), len);
        if written <= 0 {
            return String::from_utf8_lossy(bytes).into_owned();
        }

        String::from_utf16_lossy(&buffer[..written as usize])
    }
}

#[cfg(not(windows))]
fn decode_console_output(bytes: &[u8]) -> String {
    String::from_utf8_lossy(bytes).into_owned()
}

/// Reconoce las líneas de datos de `arp -a` por su FORMA (ip + mac), no por el
/// texto de sus encabezados: así se descartan solas las líneas de
/// "Interface: ..." y de cabecera de columnas sin depender del idioma de Windows.
fn parse_arp_table(arp_output: &str) -> Vec<DiscoveredDevice> {
    arp_output
        .lines()
        .filter_map(|line| {
            let mut tokens = line.split_whitespace();
            let ip = tokens.next()?.parse::<Ipv4Addr>().ok()?;
            let mac = tokens.next()?;

            if !is_mac_shaped(mac) || is_non_host_mac(mac) {
                return None;
            }

            Some(DiscoveredDevice { ip: ip.to_string(), mac: mac.to_lowercase(), role: DeviceRole::Other })
        })
        .collect()
}

fn is_mac_shaped(candidate: &str) -> bool {
    let groups: Vec<&str> = candidate.split(['-', ':']).collect();
    groups.len() == 6 && groups.iter().all(|g| g.len() == 2 && g.chars().all(|c| c.is_ascii_hexdigit()))
}

fn is_non_host_mac(mac: &str) -> bool {
    let normalized = mac.to_lowercase().replace(':', "-");
    normalized == BROADCAST_MAC || normalized.starts_with(MULTICAST_MAC_PREFIX)
}

#[cfg(test)]
mod tests {
    use super::*;

    const IPCONFIG_ES: &str = "\
Adaptador de LAN inalámbrica Wi-Fi:

   Sufijo DNS específico para la conexión. . :
   Vínculo: dirección IPv6 local. . . . . . : fe80::1234
   Dirección IPv4. . . . . . . . . . . . . . : 192.168.1.23(Preferido)
   Máscara de subred . . . . . . . . . . . . : 255.255.255.0
   Puerta de enlace predeterminada. . . . . : 192.168.1.1
";

    const IPCONFIG_EN: &str = "\
Wireless LAN adapter Wi-Fi:

   Connection-specific DNS Suffix  . :
   IPv4 Address. . . . . . . . . . . : 192.168.1.23(Preferred)
   Subnet Mask . . . . . . . . . . . : 255.255.255.0
   Default Gateway . . . . . . . . . : 192.168.1.1
";

    // Captura real de esta misma máquina: el adaptador virtual de WSL/Hyper-V
    // aparece ANTES que el Wi-Fi real y sí tiene una IPv4 válida (no APIPA) --
    // sin el filtro de adaptador virtual, esto haría que se escaneara
    // 172.20.240.0/20 en vez de la red real.
    const IPCONFIG_WITH_VIRTUAL_ADAPTER_FIRST: &str = "\
Adaptador de Ethernet vEthernet (WSL (Hyper-V firewall)):

   Sufijo DNS específico para la conexión. . :
   Dirección IPv4. . . . . . . . . . . . . . : 172.20.240.1
   Máscara de subred . . . . . . . . . . . . : 255.255.240.0
   Puerta de enlace predeterminada. . . . . :

Adaptador de LAN inalámbrica Conexión de área local* 1:

   Estado de los medios. . . . . . . . . . . : medios desconectados

Adaptador de LAN inalámbrica Wi-Fi:

   Sufijo DNS específico para la conexión. . :
   Dirección IPv4. . . . . . . . . . . . . . : 192.168.1.41
   Máscara de subred . . . . . . . . . . . . : 255.255.255.0
   Puerta de enlace predeterminada. . . . . : 192.168.1.1
";

    const ARP_A_OUTPUT: &str = "\
Interface: 192.168.1.23 --- 0xe
  Internet Address      Physical Address      Type
  192.168.1.1            18-56-80-3b-2c-11     dynamic
  192.168.1.42            aa-bb-cc-dd-ee-ff     dynamic
  192.168.1.255          ff-ff-ff-ff-ff-ff     static
  224.0.0.22              01-00-5e-00-00-16     static
";

    fn ip(text: &str) -> Ipv4Addr {
        text.parse().unwrap()
    }

    #[test]
    fn parse_local_interface_supports_spanish_locale() {
        let interface = parse_local_interface(IPCONFIG_ES).unwrap();
        assert_eq!((interface.ip, interface.mask, interface.gateway), (ip("192.168.1.23"), ip("255.255.255.0"), Some(ip("192.168.1.1"))));
    }

    #[test]
    fn parse_local_interface_supports_english_locale() {
        let interface = parse_local_interface(IPCONFIG_EN).unwrap();
        assert_eq!((interface.ip, interface.mask, interface.gateway), (ip("192.168.1.23"), ip("255.255.255.0"), Some(ip("192.168.1.1"))));
    }

    #[test]
    fn parse_local_interface_skips_virtual_adapters_listed_before_the_real_one() {
        let interface = parse_local_interface(IPCONFIG_WITH_VIRTUAL_ADAPTER_FIRST).unwrap();
        assert_eq!((interface.ip, interface.gateway), (ip("192.168.1.41"), Some(ip("192.168.1.1"))));
    }

    #[test]
    fn parse_local_interface_skips_apipa_addresses() {
        let output = "IPv4 Address. . . : 169.254.1.5\nSubnet Mask . . . : 255.255.0.0\n";
        assert_eq!(parse_local_interface(output), None);
    }

    // Captura real (ipconfig /all, español) de esta máquina, recortada.
    const IPCONFIG_ALL_ES: &str = "\
Adaptador de LAN inalámbrica Wi-Fi:

   Descripción . . . . . . . . . . . . . . . : Intel(R) Wi-Fi 6 AX200 160MHz
   Dirección física. . . . . . . . . . . . . : 8C-C6-81-16-00-85
   Vínculo: dirección IPv6 local. . . : fe80::70c1:23b3:b526:2f32%15(Preferido)
   Dirección IPv4. . . . . . . . . . . . . . : 192.168.0.103(Preferido)
   Máscara de subred . . . . . . . . . . . . : 255.255.255.0
   Puerta de enlace predeterminada . . . . . : 192.168.0.1
   Servidor DHCP . . . . . . . . . . . . . . : 192.168.0.1
";

    #[test]
    fn parse_local_interface_reads_the_adapter_mac_from_ipconfig_all() {
        let interface = parse_local_interface(IPCONFIG_ALL_ES).unwrap();
        assert_eq!(interface.mac.as_deref(), Some("8c-c6-81-16-00-85"));
        assert_eq!(interface.gateway, Some(ip("192.168.0.1")));
    }

    #[test]
    fn parse_local_interface_takes_the_ipv4_gateway_when_ipv6_is_listed_first() {
        let output = "\
Wireless LAN adapter Wi-Fi:

   Physical Address. . . . . . . . . : 8C-C6-81-16-00-85
   IPv4 Address. . . . . . . . . . . : 10.0.0.20(Preferred)
   Subnet Mask . . . . . . . . . . . : 255.255.255.0
   Default Gateway . . . . . . . . . : fe80::1%15
                                       10.0.0.1
   DHCP Server . . . . . . . . . . . : 10.0.0.1
";
        assert_eq!(parse_local_interface(output).unwrap().gateway, Some(ip("10.0.0.1")));
    }

    fn device(ip: &str, mac: &str) -> DiscoveredDevice {
        DiscoveredDevice { ip: ip.to_string(), mac: mac.to_string(), role: DeviceRole::Other }
    }

    // El caso real que mostraba "1 dispositivo": router + celular en la tabla ARP,
    // y este PC (que nunca aparece en su propia tabla ARP) quedaba sin contar.
    #[test]
    fn classify_devices_marks_the_router_and_adds_this_computer() {
        let interface = LocalInterface {
            ip: ip("192.168.0.103"),
            mask: ip("255.255.255.0"),
            gateway: Some(ip("192.168.0.1")),
            mac: Some("8c-c6-81-16-00-85".to_string()),
        };
        let neighbors = vec![
            device("192.168.0.1", "3c-6a-d2-c8-5a-ec"),
            device("192.168.0.100", "82-dc-10-19-ea-cf"),
            device("172.20.240.5", "00-15-5d-00-00-01"), // otra interfaz (WSL): fuera de la subred
        ];

        let devices = classify_devices(&interface, neighbors);
        let roles: Vec<(&str, DeviceRole)> = devices.iter().map(|d| (d.ip.as_str(), d.role)).collect();

        assert_eq!(
            roles,
            vec![
                ("192.168.0.1", DeviceRole::Gateway),
                ("192.168.0.100", DeviceRole::Other),
                ("192.168.0.103", DeviceRole::ThisDevice),
            ]
        );
    }

    #[test]
    fn find_mac_for_ip_returns_the_gateway_entry_only() {
        let neighbors = parse_arp_table(ARP_A_OUTPUT);
        assert_eq!(find_mac_for_ip(&neighbors, ip("192.168.1.1")), Some("18-56-80-3b-2c-11".to_string()));
        assert_eq!(find_mac_for_ip(&neighbors, ip("192.168.1.99")), None);
    }

    #[test]
    fn device_roles_serialize_as_the_backend_expects() {
        assert_eq!(serde_json::to_string(&DeviceRole::ThisDevice).unwrap(), "\"this_device\"");
        assert_eq!(serde_json::to_string(&DeviceRole::Gateway).unwrap(), "\"gateway\"");
    }

    #[test]
    fn hosts_in_subnet_excludes_network_broadcast_and_own_ip() {
        let ip: Ipv4Addr = "192.168.1.23".parse().unwrap();
        let mask: Ipv4Addr = "255.255.255.0".parse().unwrap();

        let hosts = hosts_in_subnet(ip, mask, ip);

        assert_eq!(hosts.len(), 253); // 254 hosts posibles menos la propia IP
        assert!(!hosts.contains(&ip));
        assert!(!hosts.contains(&"192.168.1.0".parse().unwrap()));
        assert!(!hosts.contains(&"192.168.1.255".parse().unwrap()));
    }

    #[test]
    fn parse_arp_table_keeps_only_dynamic_host_entries_by_shape() {
        let devices = parse_arp_table(ARP_A_OUTPUT);

        assert_eq!(devices.len(), 2);
        assert!(devices.iter().any(|d| d.ip == "192.168.1.1" && d.mac == "18-56-80-3b-2c-11"));
        assert!(devices.iter().any(|d| d.ip == "192.168.1.42" && d.mac == "aa-bb-cc-dd-ee-ff"));
    }

    #[test]
    fn is_mac_shaped_rejects_malformed_values() {
        assert!(is_mac_shaped("aa-bb-cc-dd-ee-ff"));
        assert!(!is_mac_shaped("Type"));
        assert!(!is_mac_shaped("aa-bb-cc"));
    }

    #[test]
    fn is_non_host_mac_detects_broadcast_and_multicast() {
        assert!(is_non_host_mac("FF-FF-FF-FF-FF-FF"));
        assert!(is_non_host_mac("01-00-5e-00-00-16"));
        assert!(!is_non_host_mac("aa-bb-cc-dd-ee-ff"));
    }

    #[test]
    #[cfg(windows)]
    fn decode_console_output_handles_oem_codepage_accents() {
        // Bytes reales que devuelve `ipconfig` en Windows en español (CP850) para
        // "Dirección IPv4": 0xA2 es 'ó' en CP850, no UTF-8 válido. Antes del fix,
        // String::from_utf8_lossy lo reemplazaba por U+FFFD y rompía el parseo de
        // "Dirección IPv4" -> las etiquetas dejaban de matchear silenciosamente.
        let cp850_bytes = [b'D', b'i', b'r', b'e', b'c', b'c', b'i', 0xA2, b'n'];
        assert_eq!(decode_console_output(&cp850_bytes), "Direcci\u{f3}n");
    }
}

use std::net::{IpAddr, Ipv4Addr};
use std::process::Command;
use std::time::Duration;

use serde::Serialize;
use surge_ping::{Client, PingIdentifier, PingSequence};
use tokio::task::JoinSet;

use crate::ping::new_client;

/// Comando nativo de Windows para leer la configuración IP de las interfaces activas.
const IPCONFIG_COMMAND: &str = "ipconfig";
/// Etiquetas de campo (normalizadas: sin espacios/puntos, en minúsculas) para la
/// IPv4 y la máscara de subred, según el idioma de Windows.
const IPV4_ADDRESS_LABELS: [&str; 2] = ["ipv4address", "direcciónipv4"];
const SUBNET_MASK_LABELS: [&str; 2] = ["subnetmask", "máscaradesubred"];

/// Comando nativo de Windows para leer la tabla ARP real del sistema.
const ARP_COMMAND: &str = "arp";
const ARP_ARGS: [&str; 1] = ["-a"];
const BROADCAST_MAC: &str = "ff-ff-ff-ff-ff-ff";
const MULTICAST_MAC_PREFIX: &str = "01-00-5e";

/// Timeout corto por IP: no necesitamos una respuesta ICMP real, solo forzar
/// que el SO intente resolver la MAC por ARP (eso ocurre en la capa IP antes
/// de enviar el paquete, responda o no el destino).
const ARP_TRIGGER_TIMEOUT: Duration = Duration::from_millis(300);
/// Límite de IPs a barrer: evita un escaneo desmedido si un adaptador (ej. VPN)
/// reporta una máscara inusualmente amplia; una LAN doméstica (/24) nunca lo alcanza.
const MAX_HOSTS_TO_SCAN: usize = 512;

/// Dispositivo descubierto por ARP: solo IP y MAC, el nombre casi nunca está
/// disponible por este medio y no debe inventarse (queda a cargo del backend/UI).
#[derive(Serialize, Clone)]
pub struct DiscoveredDevice {
    pub ip: String,
    pub mac: String,
}

/// Descubre los dispositivos realmente conectados a la LAN local: determina
/// la subred propia, fuerza su resolución ARP con un barrido concurrente, y
/// lee la tabla ARP resultante.
#[tauri::command]
pub async fn scan_connected_devices() -> Result<Vec<DiscoveredDevice>, String> {
    let (local_ip, mask) = tokio::task::spawn_blocking(local_ipv4_and_mask)
        .await
        .map_err(|e| format!("no se pudo determinar la subred local: {e}"))??;

    let targets = hosts_in_subnet(local_ip, mask, local_ip);
    let client = new_client(IpAddr::V4(local_ip))?;

    let mut sweep = JoinSet::new();
    for (sequence, ip) in targets.into_iter().enumerate() {
        let client = client.clone();
        sweep.spawn(async move { trigger_arp_resolution(&client, ip, sequence as u16).await });
    }
    // Los pings corren en paralelo: el barrido completo tarda ~ARP_TRIGGER_TIMEOUT,
    // no ARP_TRIGGER_TIMEOUT * cantidad_de_hosts. Ignoramos éxito/fallo individual.
    while sweep.join_next().await.is_some() {}

    let arp_output = tokio::task::spawn_blocking(run_arp_a)
        .await
        .map_err(|e| format!("no se pudo ejecutar arp: {e}"))??;

    let network = u32::from(local_ip) & u32::from(mask);
    let broadcast = network | !u32::from(mask);

    let devices = parse_arp_table(&arp_output)
        .into_iter()
        .filter(|device| {
            device
                .ip
                .parse::<Ipv4Addr>()
                .map(|ip| ip != local_ip && u32::from(ip) > network && u32::from(ip) < broadcast)
                .unwrap_or(false)
        })
        .collect();

    Ok(devices)
}

fn local_ipv4_and_mask() -> Result<(Ipv4Addr, Ipv4Addr), String> {
    let output = Command::new(IPCONFIG_COMMAND)
        .output()
        .map_err(|e| format!("no se pudo lanzar ipconfig: {e}"))?;

    if !output.status.success() {
        return Err("ipconfig devolvió un error".to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_local_ipv4_config(&stdout).ok_or_else(|| "no se encontró una IPv4 local válida".to_string())
}

/// Busca el primer adaptador con una IPv4 real (no APIPA 169.254.x.x) y su
/// máscara asociada. No asume nombre de adaptador ni rango: los deriva del
/// propio texto de ipconfig.
fn parse_local_ipv4_config(ipconfig_output: &str) -> Option<(Ipv4Addr, Ipv4Addr)> {
    let mut pending_ip: Option<Ipv4Addr> = None;

    for line in ipconfig_output.lines() {
        let Some((label, value)) = line.split_once(':') else { continue };
        let label = normalize_label(label);
        let value = value.trim();

        if IPV4_ADDRESS_LABELS.contains(&label.as_str()) {
            // ipconfig a veces agrega "(Preferido)"/"(Preferred)" pegado al valor.
            let ip_text = value.split('(').next().unwrap_or(value).trim();
            pending_ip = ip_text.parse::<Ipv4Addr>().ok().filter(|ip| !is_link_local(*ip));
        } else if SUBNET_MASK_LABELS.contains(&label.as_str()) {
            if let (Some(ip), Ok(mask)) = (pending_ip, value.parse::<Ipv4Addr>()) {
                return Some((ip, mask));
            }
        }
    }

    None
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
    let output = Command::new(ARP_COMMAND).args(ARP_ARGS).output().map_err(|e| format!("no se pudo lanzar arp: {e}"))?;

    if !output.status.success() {
        return Err("arp -a devolvió un error".to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
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

            Some(DiscoveredDevice { ip: ip.to_string(), mac: mac.to_lowercase() })
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

    const ARP_A_OUTPUT: &str = "\
Interface: 192.168.1.23 --- 0xe
  Internet Address      Physical Address      Type
  192.168.1.1            18-56-80-3b-2c-11     dynamic
  192.168.1.42            aa-bb-cc-dd-ee-ff     dynamic
  192.168.1.255          ff-ff-ff-ff-ff-ff     static
  224.0.0.22              01-00-5e-00-00-16     static
";

    #[test]
    fn parse_local_ipv4_config_supports_spanish_locale() {
        let expected = ("192.168.1.23".parse().unwrap(), "255.255.255.0".parse().unwrap());
        assert_eq!(parse_local_ipv4_config(IPCONFIG_ES), Some(expected));
    }

    #[test]
    fn parse_local_ipv4_config_supports_english_locale() {
        let expected = ("192.168.1.23".parse().unwrap(), "255.255.255.0".parse().unwrap());
        assert_eq!(parse_local_ipv4_config(IPCONFIG_EN), Some(expected));
    }

    #[test]
    fn parse_local_ipv4_config_skips_apipa_addresses() {
        let output = "IPv4 Address. . . : 169.254.1.5\nSubnet Mask . . . : 255.255.0.0\n";
        assert_eq!(parse_local_ipv4_config(output), None);
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
}

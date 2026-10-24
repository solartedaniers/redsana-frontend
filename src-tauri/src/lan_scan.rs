use std::collections::{HashMap, HashSet};
use std::future::Future;
use std::net::{IpAddr, Ipv4Addr};
use crate::console_command::hidden_console_command;
use std::sync::Arc;
use std::time::{Duration, Instant};

use serde::Serialize;
use surge_ping::{Client, PingIdentifier, PingSequence};
use tokio::sync::Semaphore;
use tokio::task::JoinSet;

use crate::ping::new_client;

/// Configuración IP de Windows; "/all" agrega la MAC del adaptador para contar a este equipo en la red.
const IPCONFIG_COMMAND: &str = "ipconfig";
const IPCONFIG_ARGS: [&str; 1] = ["/all"];
/// Etiquetas normalizadas (sin espacios ni puntos, en minúsculas) de la IPv4 y la máscara, según el idioma.
const IPV4_ADDRESS_LABELS: [&str; 2] = ["ipv4address", "direcciónipv4"];
const SUBNET_MASK_LABELS: [&str; 2] = ["subnetmask", "máscaradesubred"];
const PHYSICAL_ADDRESS_LABELS: [&str; 2] = ["physicaladdress", "direcciónfísica"];
const DEFAULT_GATEWAY_LABELS: [&str; 2] = ["defaultgateway", "puertadeenlacepredeterminada"];

/// Palabras que delatan un adaptador virtual o túnel. Suelen salir ANTES del físico y, sin filtrarlos,
/// el escaneo barría la subred virtual (172.20.x.x) en vez de la red real.
const VIRTUAL_ADAPTER_MARKERS: [&str; 6] = ["virtual", "vethernet", "vpn", "tunel", "túnel", "loopback"];

const ARP_COMMAND: &str = "arp";
const ARP_ARGS: [&str; 1] = ["-a"];
const BROADCAST_MAC: &str = "ff-ff-ff-ff-ff-ff";
const MULTICAST_MAC_PREFIX: &str = "01-00-5e";

/// Timeout corto: no busco respuesta ICMP, solo forzar que el sistema resuelva la MAC por ARP.
const ARP_TRIGGER_TIMEOUT: Duration = Duration::from_millis(300);
/// Tope de IPs a barrer ante máscaras muy amplias; 4096 cubre hasta un /20 y, como es concurrente, no multiplica el tiempo.
const MAX_HOSTS_TO_SCAN: usize = 4096;
/// Espera entre pasadas: un celular en ahorro de energía contesta el ARP tarde y con una sola pasada quedaba fuera.
const SWEEP_SETTLE_DELAY: Duration = Duration::from_millis(1000);
const SWEEP_PASSES: usize = 2;

/// Escaneo manual. `arp -a` sigue listando por minutos a un celular que ya se desconectó, así que cada equipo
/// se confirma en el momento con un ARP propio (SendARP), que Windows sí envía a la red aunque tenga la MAC guardada.
/// Variables de entorno para ajustar sus límites sin recompilar (ver PresenceScanLimits).
const PRESENCE_MAX_HOSTS_ENV: &str = "REDSANA_LAN_SCAN_MAX_HOSTS";
const PRESENCE_PING_CONCURRENCY_ENV: &str = "REDSANA_LAN_SCAN_PING_CONCURRENCY";
const PRESENCE_ARP_CONCURRENCY_ENV: &str = "REDSANA_LAN_SCAN_ARP_CONCURRENCY";
const PRESENCE_ARP_ATTEMPTS_ENV: &str = "REDSANA_LAN_SCAN_ARP_ATTEMPTS";
/// Con esta variable (solo en compilaciones de desarrollo) cada escaneo manual explica en la consola qué decidió
/// con cada equipo y por qué.
const PRESENCE_DIAGNOSTICS_ENV: &str = "REDSANA_LAN_SCAN_DIAGNOSTICS";
/// Solo para ese registro: el estado de cada vecino según Windows. Los estados salen en inglés en cualquier idioma.
const NEIGHBOR_COMMAND: &str = "powershell";
const NEIGHBOR_ARGS: [&str; 4] = [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    "Get-NetNeighbor -AddressFamily IPv4 | ForEach-Object { \"$($_.IPAddress) $($_.State)\" }",
];

/// Límites y tiempos del escaneo manual. Los valores por defecto salen de lo medido en una casa (2 equipos) y en
/// la red de una universidad (/21, ~290 equipos, 171 escaneos).
#[derive(Clone, Copy, Debug)]
struct PresenceScanLimits {
    /// IPs que se barren como máximo; en subredes más grandes, las más cercanas a este equipo.
    max_hosts: usize,
    /// Pings en vuelo a la vez: acotados para no lanzar miles de golpe en una red compartida.
    ping_concurrency: usize,
    /// Confirmaciones ARP a la vez; cada una ocupa un hilo mientras Windows espera la respuesta.
    arp_concurrency: usize,
    /// Intentos de SendARP por equipo; cada intento fallido dura lo que Windows reintenta el ARP (~3,7 s).
    arp_attempts: usize,
    /// Aquí sí importa la respuesta del ping: un celular en ahorro de energía tarda más que ARP_TRIGGER_TIMEOUT.
    ping_timeout: Duration,
    /// Tras el barrido espero a que Windows termine de resolver a los recién llegados (un celular dormido tardó 3,1 s).
    settle_delay: Duration,
    /// Ping directo a cada equipo de la tabla, a la vez que su ARP: el router lo guarda hasta que el celular
    /// despierta la radio, mientras que un celular dormido puede ignorar el ARP de difusión (en casa, 62 % de los
    /// escaneos con la pantalla apagada).
    direct_ping_timeout: Duration,
}

impl Default for PresenceScanLimits {
    fn default() -> Self {
        Self {
            // 4096 cubre hasta un /20; la red de la universidad es un /21 (2046 direcciones).
            max_hosts: 4096,
            ping_concurrency: 512,
            // Por encima de los ~76 que no contestan en una red de 450: si no, esos ocuparían todos los cupos.
            arp_concurrency: 128,
            // En la universidad el 2.º intento recuperó ~20 % de los que no contestaron el 1.º.
            arp_attempts: 2,
            ping_timeout: Duration::from_millis(1000),
            settle_delay: Duration::from_millis(3000),
            direct_ping_timeout: Duration::from_millis(3000),
        }
    }
}

impl PresenceScanLimits {
    fn from_env() -> Self {
        let default = Self::default();
        Self {
            max_hosts: env_count(PRESENCE_MAX_HOSTS_ENV).unwrap_or(default.max_hosts),
            ping_concurrency: env_count(PRESENCE_PING_CONCURRENCY_ENV).unwrap_or(default.ping_concurrency),
            arp_concurrency: env_count(PRESENCE_ARP_CONCURRENCY_ENV).unwrap_or(default.arp_concurrency),
            arp_attempts: env_count(PRESENCE_ARP_ATTEMPTS_ENV).unwrap_or(default.arp_attempts),
            ..default
        }
    }
}

/// Un número positivo de la variable; vacía, cero o inválida deja el valor por defecto.
fn env_count(name: &str) -> Option<usize> {
    parse_count(&std::env::var(name).ok()?)
}

fn parse_count(raw: &str) -> Option<usize> {
    raw.trim().parse().ok().filter(|value| *value > 0)
}

/// Papel en la red: el router es la red misma y este equipo no sale en su propia tabla ARP; los marco para no confundirlos.
#[derive(Serialize, Clone, Copy, Debug, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum DeviceRole {
    ThisDevice,
    Gateway,
    Other,
}

/// Dispositivo descubierto por ARP: solo IP y MAC; el nombre casi nunca está disponible y no lo invento.
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

/// Descubre los dispositivos conectados: saco la subred propia, fuerzo el ARP con un barrido concurrente y leo la tabla.
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

/// Para el botón "Escanear en busca de intrusos": cuenta solo a quien respondió en este escaneo (ping o ARP),
/// no a quien sigue en la tabla ARP de un rato antes. El escaneo automático sigue usando scan_connected_devices.
#[tauri::command]
pub async fn scan_present_devices() -> Result<Vec<DiscoveredDevice>, String> {
    let diagnostics = cfg!(debug_assertions) && std::env::var_os(PRESENCE_DIAGNOSTICS_ENV).is_some();
    scan_present_devices_with(PresenceScanLimits::from_env(), diagnostics).await
}

async fn scan_present_devices_with(limits: PresenceScanLimits, diagnostics: bool) -> Result<Vec<DiscoveredDevice>, String> {
    let started = Instant::now();
    let interface = tokio::task::spawn_blocking(local_interface)
        .await
        .map_err(|e| format!("no se pudo determinar la subred local: {e}"))??;
    let states = if diagnostics { neighbor_states().await } else { HashMap::new() };

    let probe = Arc::new(SystemProbe {
        client: new_client(IpAddr::V4(interface.ip))?,
        local_ip: interface.ip,
        mask: interface.mask,
    });
    let decisions = decide_presence(probe, interface.ip, interface.mask, limits).await?;
    if diagnostics {
        log_presence_decisions(&decisions, &states, started.elapsed());
    }

    let present = decisions
        .into_iter()
        .filter_map(|decision| {
            let mac = decision.present_mac()?;
            Some(DiscoveredDevice { ip: decision.ip.to_string(), mac, role: DeviceRole::Other })
        })
        .collect();
    Ok(classify_devices(&interface, present))
}

/// Lo que el escaneo manual necesita del sistema; va aparte para poder simular una red grande en las pruebas.
trait PresenceProbe: Send + Sync + 'static {
    /// Vecinos de la subred propia en la tabla ARP, con su MAC (sin distinguir si están vencidos). Bloqueante.
    fn neighbors(&self) -> Result<HashMap<Ipv4Addr, String>, String>;
    /// ARP propio a esa IP; None si nadie contestó. Bloqueante.
    fn resolve_mac(&self, ip: Ipv4Addr) -> Option<String>;
    fn ping(&self, ip: Ipv4Addr, timeout: Duration) -> impl Future<Output = bool> + Send;
}

struct SystemProbe {
    client: Client,
    local_ip: Ipv4Addr,
    mask: Ipv4Addr,
}

impl PresenceProbe for SystemProbe {
    fn neighbors(&self) -> Result<HashMap<Ipv4Addr, String>, String> {
        Ok(parse_arp_table(&run_arp_a()?)
            .into_iter()
            .filter_map(|device| Some((device.ip.parse::<Ipv4Addr>().ok()?, device.mac)))
            .filter(|(ip, _)| is_in_subnet(self.local_ip, self.mask, *ip) && *ip != self.local_ip)
            .collect())
    }

    fn resolve_mac(&self, ip: Ipv4Addr) -> Option<String> {
        resolve_mac_by_arp(ip)
    }

    async fn ping(&self, ip: Ipv4Addr, timeout: Duration) -> bool {
        // Identificador por IP: en una ventana de hasta 65536 direcciones no se repite.
        let id = u32::from(ip) as u16;
        let mut pinger = self.client.pinger(IpAddr::V4(ip), PingIdentifier(id)).await;
        pinger.timeout(timeout);
        pinger.ping(PingSequence(id), &[]).await.is_ok()
    }
}

/// Decide quién está: los de la tabla se confirman por ARP mientras el barrido busca a los recién llegados.
async fn decide_presence<P: PresenceProbe>(
    probe: Arc<P>,
    local_ip: Ipv4Addr,
    mask: Ipv4Addr,
    limits: PresenceScanLimits,
) -> Result<Vec<PresenceDecision>, String> {
    let known = Arc::new(read_neighbors(&probe).await?);
    let known_ips: Vec<Ipv4Addr> = known.keys().copied().collect();
    let known_checks = tokio::spawn(verify_by_arp(probe.clone(), known_ips, known.clone(), limits));

    let replied = sweep_for_replies(probe.clone(), presence_targets(local_ip, mask, limits.max_hosts), limits).await;
    tokio::time::sleep(limits.settle_delay).await;
    let after_sweep = read_neighbors(&probe).await?;

    let mut decisions = known_checks.await.map_err(|e| format!("no se pudo confirmar por ARP: {e}"))?;
    for decision in &mut decisions {
        if decision.evidence.is_none() && replied.contains(&decision.ip) {
            decision.evidence = Some(PresenceEvidence::Ping);
        }
    }
    // Entrar a la tabla durante el escaneo ya es haber contestado el ARP que provocó el barrido: no lo repito.
    decisions.extend(after_sweep.iter().filter(|(ip, _)| !known.contains_key(ip)).map(|(ip, mac)| PresenceDecision {
        ip: *ip,
        mac: Some(mac.clone()),
        evidence: Some(PresenceEvidence::AppearedDuringScan),
        arp_attempts: 0,
        elapsed: Duration::ZERO,
    }));
    // Contestaron el ping pero no figuran en ninguna tabla: solo falta su MAC.
    let unmapped: Vec<Ipv4Addr> = replied
        .iter()
        .filter(|ip| !known.contains_key(ip) && !after_sweep.contains_key(ip))
        .copied()
        .collect();
    decisions.extend(verify_by_arp(probe, unmapped, Arc::new(HashMap::new()), limits).await);
    Ok(decisions)
}

async fn read_neighbors<P: PresenceProbe>(probe: &Arc<P>) -> Result<HashMap<Ipv4Addr, String>, String> {
    let probe = probe.clone();
    tokio::task::spawn_blocking(move || probe.neighbors())
        .await
        .map_err(|e| format!("no se pudo ejecutar arp: {e}"))?
}

/// Ping a toda la subred con un tope de pings en vuelo; devuelve quién contestó.
async fn sweep_for_replies<P: PresenceProbe>(probe: Arc<P>, targets: Vec<Ipv4Addr>, limits: PresenceScanLimits) -> HashSet<Ipv4Addr> {
    let permits = Arc::new(Semaphore::new(limits.ping_concurrency));
    let mut sweep = JoinSet::new();
    for ip in targets {
        let (probe, permits) = (probe.clone(), permits.clone());
        sweep.spawn(async move {
            let _permit = permits.acquire_owned().await.ok()?;
            probe.ping(ip, limits.ping_timeout).await.then_some(ip)
        });
    }

    let mut replied = HashSet::new();
    while let Some(result) = sweep.join_next().await {
        if let Ok(Some(ip)) = result {
            replied.insert(ip);
        }
    }
    replied
}

/// Confirma cada IP con SendARP (hasta arp_attempts) y a la vez con un ping directo; con tope de confirmaciones
/// a la vez para no agotar hilos. table_macs da la MAC si solo contestó el ping.
async fn verify_by_arp<P: PresenceProbe>(
    probe: Arc<P>,
    ips: Vec<Ipv4Addr>,
    table_macs: Arc<HashMap<Ipv4Addr, String>>,
    limits: PresenceScanLimits,
) -> Vec<PresenceDecision> {
    let permits = Arc::new(Semaphore::new(limits.arp_concurrency));
    let mut checks = JoinSet::new();
    for ip in ips {
        let (probe, permits, table_macs) = (probe.clone(), permits.clone(), table_macs.clone());
        checks.spawn(async move {
            let permit = permits.acquire_owned().await.ok();
            let started = Instant::now();
            let arp_probe = probe.clone();
            let arp = tokio::task::spawn_blocking(move || {
                // El cupo dura lo que dure el ARP aunque el ping ya haya decidido: así el tope de hilos se respeta.
                let _permit = permit;
                let mut mac = None;
                let mut attempts = 0;
                while mac.is_none() && attempts < limits.arp_attempts {
                    mac = arp_probe.resolve_mac(ip);
                    attempts += 1;
                }
                (mac, attempts)
            });

            let answered_ping = probe.ping(ip, limits.direct_ping_timeout).await;
            let table_mac = table_macs.get(&ip).cloned();
            if answered_ping && table_mac.is_some() && !arp.is_finished() {
                // Ya contestó: no espero a que el ARP termine sus intentos.
                return PresenceDecision {
                    ip,
                    mac: table_mac,
                    evidence: Some(PresenceEvidence::DirectPing),
                    arp_attempts: 0,
                    elapsed: started.elapsed(),
                };
            }

            let (arp_mac, arp_attempts) = arp.await.unwrap_or((None, limits.arp_attempts));
            let (mac, evidence) = match arp_mac {
                Some(mac) => (Some(mac), Some(PresenceEvidence::Arp)),
                None => (table_mac, answered_ping.then_some(PresenceEvidence::DirectPing)),
            };
            PresenceDecision { ip, mac, evidence, arp_attempts, elapsed: started.elapsed() }
        });
    }

    let mut done = Vec::new();
    while let Some(result) = checks.join_next().await {
        if let Ok(decision) = result {
            done.push(decision);
        }
    }
    done
}

/// Las IPs a barrer sin este equipo. Si la subred supera max_hosts, una ventana alrededor de este equipo: antes se
/// tomaban las primeras de la red y en un /16 quedaban fuera los vecinos reales.
fn presence_targets(local_ip: Ipv4Addr, mask: Ipv4Addr, max_hosts: usize) -> Vec<Ipv4Addr> {
    let network = u32::from(local_ip) & u32::from(mask);
    let broadcast = network | !u32::from(mask);
    if broadcast <= network + 1 || max_hosts == 0 {
        return Vec::new();
    }

    let (first, last) = (u64::from(network) + 1, u64::from(broadcast) - 1);
    let own = u64::from(u32::from(local_ip));
    let span = max_hosts as u64;
    let start = own.saturating_sub(span / 2).max(first).min(last.saturating_sub(span).max(first));
    let end = (start + span).min(last);
    (start..=end)
        .filter(|bits| *bits != own)
        .take(max_hosts)
        .map(|bits| Ipv4Addr::from(bits as u32))
        .collect()
}

fn is_in_subnet(local_ip: Ipv4Addr, mask: Ipv4Addr, ip: Ipv4Addr) -> bool {
    let mask = u32::from(mask);
    u32::from(ip) & mask == u32::from(local_ip) & mask
}

/// Pregunta la MAC por ARP; Windows reintenta solo y devuelve error si nadie contesta.
#[cfg(windows)]
fn resolve_mac_by_arp(ip: Ipv4Addr) -> Option<String> {
    #[link(name = "iphlpapi")]
    extern "system" {
        fn SendARP(dest_ip: u32, src_ip: u32, mac_addr: *mut u8, phy_addr_len: *mut u32) -> u32;
    }

    let mut mac = [0u8; 8];
    let mut len = mac.len() as u32;
    // SendARP recibe la IP en el orden en que viaja por la red.
    let result = unsafe { SendARP(u32::from_ne_bytes(ip.octets()), 0, mac.as_mut_ptr(), &mut len) };
    (result == 0 && len == 6).then(|| format_mac(&mac[..6]))
}

#[cfg(not(windows))]
fn resolve_mac_by_arp(_ip: Ipv4Addr) -> Option<String> {
    None
}

/// El mismo formato que `arp -a` en minúsculas: la MAC es la llave con la que el backend reconoce al equipo.
fn format_mac(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect::<Vec<_>>().join("-")
}

/// Por qué se dio por presente a un equipo.
#[derive(Clone, Copy, Debug, PartialEq)]
enum PresenceEvidence {
    Arp,
    Ping,
    AppearedDuringScan,
    DirectPing,
}

#[derive(Debug)]
struct PresenceDecision {
    ip: Ipv4Addr,
    /// La del ARP de este escaneo o, si no contestó el ARP, la que había en la tabla.
    mac: Option<String>,
    /// None: no respondió a nada en este escaneo.
    evidence: Option<PresenceEvidence>,
    arp_attempts: usize,
    elapsed: Duration,
}

impl PresenceDecision {
    fn present_mac(&self) -> Option<String> {
        self.evidence.and(self.mac.clone())
    }

    fn reason(&self) -> &'static str {
        match (self.evidence, self.mac.is_some()) {
            (Some(PresenceEvidence::Arp), _) => "respondió el ARP de este escaneo",
            (Some(PresenceEvidence::Ping), true) => "respondió el ping",
            (Some(PresenceEvidence::AppearedDuringScan), _) => "apareció en la tabla durante este escaneo",
            (Some(PresenceEvidence::DirectPing), true) => "respondió el ping directo",
            (Some(_), false) => "respondió el ping pero no se obtuvo su MAC",
            (None, _) => "no respondió ni ARP ni ping: estaba en la tabla de antes",
        }
    }
}

async fn neighbor_states() -> HashMap<Ipv4Addr, String> {
    let output = tokio::task::spawn_blocking(|| {
        hidden_console_command(NEIGHBOR_COMMAND).args(NEIGHBOR_ARGS).output().ok().map(|out| decode_console_output(&out.stdout))
    })
    .await
    .ok()
    .flatten()
    .unwrap_or_default();
    parse_neighbor_states(&output)
}

fn parse_neighbor_states(output: &str) -> HashMap<Ipv4Addr, String> {
    output
        .lines()
        .filter_map(|line| {
            let mut tokens = line.split_whitespace();
            Some((tokens.next()?.parse().ok()?, tokens.next()?.to_string()))
        })
        .collect()
}

fn log_presence_decisions(decisions: &[PresenceDecision], states: &HashMap<Ipv4Addr, String>, elapsed: Duration) {
    let present = decisions.iter().filter(|decision| decision.present_mac().is_some()).count();
    eprintln!("[lan-scan] escaneo manual: {present} presentes de {} revisados en {elapsed:.1?}", decisions.len());
    let mut sorted: Vec<&PresenceDecision> = decisions.iter().collect();
    sorted.sort_by_key(|decision| decision.ip);
    for decision in sorted {
        eprintln!(
            "[lan-scan]   {:<15} {} estado-antes={} arp={} ({} intento(s), {:.1?}) -> {}: {}",
            decision.ip.to_string(),
            decision.mac.as_deref().unwrap_or("-"),
            states.get(&decision.ip).map(String::as_str).unwrap_or("-"),
            if decision.evidence == Some(PresenceEvidence::Arp) { "sí" } else { "no" },
            decision.arp_attempts,
            decision.elapsed,
            if decision.present_mac().is_some() { "PRESENTE" } else { "AUSENTE" },
            decision.reason(),
        );
    }
}

/// Los pings van en paralelo: una pasada tarda ~ARP_TRIGGER_TIMEOUT y no eso por cada host.
async fn sweep_subnet(client: &Client, targets: &[Ipv4Addr]) {
    let mut sweep = JoinSet::new();
    for (sequence, ip) in targets.iter().copied().enumerate() {
        let client = client.clone();
        sweep.spawn(async move { trigger_arp_resolution(&client, ip, sequence as u16).await });
    }
    while sweep.join_next().await.is_some() {}
}

/// MAC del router de la red actual, para aprender cada red por separado. Solo sale hacia el frontend
/// de este equipo, que la convierte en hash. None si no hay red.
#[tauri::command]
pub async fn current_gateway_mac() -> Result<Option<String>, String> {
    let interface = match tokio::task::spawn_blocking(local_interface).await {
        Ok(Ok(interface)) => interface,
        _ => return Ok(None), // sin adaptador con IPv4 no hay red que identificar
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

/// Router del adaptador activo; None sin red o sin router. ping.rs lo mide en cada ciclo.
pub(crate) async fn current_gateway() -> Option<Ipv4Addr> {
    match tokio::task::spawn_blocking(local_interface).await {
        Ok(Ok(interface)) => interface.gateway,
        _ => None,
    }
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

/// Deja solo los vecinos de la subred propia, marca el router y agrega este equipo.
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

/// Busca el primer adaptador FÍSICO con IPv4 real (no APIPA), su máscara, MAC y puerta de enlace,
/// descartando las secciones virtuales; no asume nombres ni rangos.
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

        // La puerta de enlace puede traer varios valores en líneas sin etiqueta (IPv6 y debajo IPv4): son un solo dato.
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
            // ipconfig a veces pega "(Preferido)" al valor.
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

/// Encabezado de adaptador: sin sangría y sin valor tras los dos puntos. Lo detecto por forma para no depender del idioma.
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

/// Direcciones host de la subred (sin red, broadcast ni la propia), hasta MAX_HOSTS_TO_SCAN.
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

/// Ping con timeout corto solo para forzar el ARP del sistema; su resultado no importa.
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

/// Decodifica la salida de consola con la página de códigos OEM activa: from_utf8_lossy rompía en silencio
/// las tildes ("Dirección") y con ellas el parseo de etiquetas.
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

    // Solo cubre la página de códigos activa al arrancar; si cambia en caliente habría que releer GetOEMCP.
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

/// Reconozco las líneas de `arp -a` por su forma (IP + MAC), así descarto encabezados sin depender del idioma.
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

    // Captura real: el adaptador de WSL sale ANTES del Wi-Fi con una IPv4 válida; sin el filtro se barría 172.20.240.0/20.
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

    // Captura real de ipconfig /all en español, recortada.
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

    // El caso real que mostraba "1 dispositivo": router y celular en la tabla ARP, y este PC sin contar.
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
    fn the_mac_from_sendarp_uses_the_same_format_as_arp() {
        let from_arp = parse_arp_table(ARP_A_OUTPUT);

        assert!(from_arp.iter().any(|device| device.mac == format_mac(&[0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff])));
    }

    #[test]
    fn parse_neighbor_states_reads_the_state_by_ip() {
        let states = parse_neighbor_states("224.0.0.22 Permanent\n192.168.0.100 Stale\nbasura\n");

        assert_eq!(states.get(&ip("192.168.0.100")).map(String::as_str), Some("Stale"));
        assert_eq!(states.len(), 2);
    }

    #[test]
    fn is_in_subnet_excludes_other_adapters() {
        assert!(is_in_subnet(ip("192.168.0.101"), ip("255.255.255.0"), ip("192.168.0.100")));
        assert!(!is_in_subnet(ip("192.168.0.101"), ip("255.255.255.0"), ip("172.20.240.5")));
    }

    #[test]
    fn presence_targets_cover_a_whole_university_sized_subnet() {
        // La red de la universidad: /21, 2046 direcciones de host menos este equipo.
        let targets = presence_targets(ip("192.168.172.52"), ip("255.255.248.0"), PresenceScanLimits::default().max_hosts);

        assert_eq!(targets.len(), 2045);
        assert_eq!(targets.first(), Some(&ip("192.168.168.1")));
        assert_eq!(targets.last(), Some(&ip("192.168.175.254")));
        assert!(!targets.contains(&ip("192.168.172.52")));
    }

    #[test]
    fn presence_targets_in_a_huge_subnet_stay_around_this_computer() {
        let targets = presence_targets(ip("10.20.130.7"), ip("255.255.0.0"), 1024);

        assert_eq!(targets.len(), 1024);
        assert!(targets.contains(&ip("10.20.130.6")) && targets.contains(&ip("10.20.130.8")));
        assert!(!targets.contains(&ip("10.20.0.1")));
    }

    #[test]
    fn presence_targets_handle_the_edges_of_the_subnet() {
        let targets = presence_targets(ip("192.168.0.2"), ip("255.255.255.0"), 10);

        assert_eq!(targets.len(), 10);
        assert_eq!(targets.first(), Some(&ip("192.168.0.1")));
        assert!(presence_targets(ip("192.168.0.2"), ip("255.255.255.255"), 10).is_empty());
    }

    #[test]
    fn parse_count_ignores_empty_zero_and_garbage() {
        assert_eq!(parse_count(" 2048 "), Some(2048));
        assert_eq!(parse_count("0"), None);
        assert_eq!(parse_count("muchos"), None);
    }

    /// Red simulada: cada IP contesta (o no) con los tiempos que se le indiquen, a escala para que la prueba sea corta.
    mod simulated {
        use super::*;
        use std::sync::atomic::{AtomicUsize, Ordering};
        use std::sync::Mutex;

        /// Los tiempos reales se dividen por esto en la simulación.
        pub const TIME_SCALE: u32 = 10;
        /// Lo que tarda SendARP en rendirse cuando nadie contesta (medido en la universidad: 3,7 s).
        pub const SENDARP_GIVE_UP: Duration = Duration::from_millis(3700);

        #[derive(Clone, Copy)]
        pub struct Host {
            /// None: no contesta el ARP; Some(d): contesta en d.
            pub arp_delay: Option<Duration>,
            /// Intentos de ARP que deja pasar antes de contestar (celular dormido).
            pub misses_first_attempts: usize,
            pub answers_ping: bool,
        }

        pub struct SimulatedNetwork {
            pub table_before: HashMap<Ipv4Addr, String>,
            pub table_after: HashMap<Ipv4Addr, String>,
            pub hosts: HashMap<Ipv4Addr, Host>,
            reads: AtomicUsize,
            attempts: Mutex<HashMap<Ipv4Addr, usize>>,
            in_flight: AtomicUsize,
            pub max_in_flight: AtomicUsize,
        }

        impl SimulatedNetwork {
            pub fn new(table_before: HashMap<Ipv4Addr, String>, table_after: HashMap<Ipv4Addr, String>, hosts: HashMap<Ipv4Addr, Host>) -> Self {
                Self {
                    table_before,
                    table_after,
                    hosts,
                    reads: AtomicUsize::new(0),
                    attempts: Mutex::new(HashMap::new()),
                    in_flight: AtomicUsize::new(0),
                    max_in_flight: AtomicUsize::new(0),
                }
            }
        }

        pub fn scaled(duration: Duration) -> Duration {
            duration / TIME_SCALE
        }

        impl PresenceProbe for SimulatedNetwork {
            fn neighbors(&self) -> Result<HashMap<Ipv4Addr, String>, String> {
                let first = self.reads.fetch_add(1, Ordering::SeqCst) == 0;
                Ok(if first { self.table_before.clone() } else { self.table_after.clone() })
            }

            fn resolve_mac(&self, ip: Ipv4Addr) -> Option<String> {
                let now = self.in_flight.fetch_add(1, Ordering::SeqCst) + 1;
                self.max_in_flight.fetch_max(now, Ordering::SeqCst);
                let attempt = {
                    let mut attempts = self.attempts.lock().unwrap();
                    let count = attempts.entry(ip).or_insert(0);
                    *count += 1;
                    *count
                };
                let host = self.hosts.get(&ip).copied();
                let answer = host.and_then(|host| host.arp_delay.filter(|_| attempt > host.misses_first_attempts));
                std::thread::sleep(scaled(answer.unwrap_or(SENDARP_GIVE_UP)));
                self.in_flight.fetch_sub(1, Ordering::SeqCst);
                answer.map(|_| mac_for(ip))
            }

            async fn ping(&self, ip: Ipv4Addr, timeout: Duration) -> bool {
                let answers = self.hosts.get(&ip).is_some_and(|host| host.answers_ping);
                tokio::time::sleep(if answers { timeout / 10 } else { timeout }).await;
                answers
            }
        }

        pub fn mac_for(ip: Ipv4Addr) -> String {
            let [a, b, c, d] = ip.octets();
            format_mac(&[0x02, 0x00, a, b, c, d])
        }

        pub fn scaled_limits() -> PresenceScanLimits {
            let limits = PresenceScanLimits::default();
            PresenceScanLimits {
                ping_timeout: scaled(limits.ping_timeout),
                settle_delay: scaled(limits.settle_delay),
                direct_ping_timeout: scaled(limits.direct_ping_timeout),
                ..limits
            }
        }

        pub fn run(network: Arc<SimulatedNetwork>, local_ip: Ipv4Addr, mask: Ipv4Addr) -> (Vec<PresenceDecision>, Duration) {
            let runtime = tokio::runtime::Builder::new_current_thread().enable_all().build().unwrap();
            let started = Instant::now();
            let decisions = runtime.block_on(decide_presence(network, local_ip, mask, scaled_limits())).unwrap();
            (decisions, started.elapsed() * TIME_SCALE)
        }
    }

    use simulated::{Host, SimulatedNetwork};

    const LOCAL_IP: &str = "192.168.172.52";
    const UNIVERSITY_MASK: &str = "255.255.248.0";

    fn university_ip(index: usize) -> Ipv4Addr {
        Ipv4Addr::from(u32::from(ip("192.168.168.1")) + index as u32)
    }

    /// 450 equipos con las proporciones medidas en la universidad: ~79 % contesta el 1.er ARP, ~4 % solo el 2.º,
    /// ~17 % no contesta nada (se fueron pero siguen en la tabla) y ~45 % contesta además el ping.
    fn university_like_network(devices: usize, silent: &HashSet<usize>) -> (HashMap<Ipv4Addr, String>, HashMap<Ipv4Addr, Host>) {
        let mut table = HashMap::new();
        let mut hosts = HashMap::new();
        for index in 0..devices {
            let address = university_ip(index);
            table.insert(address, simulated::mac_for(address));
            let gone = silent.contains(&index) || index % 100 < 17;
            hosts.insert(
                address,
                Host {
                    arp_delay: (!gone).then(|| Duration::from_millis(100 + (index as u64 * 37) % 1100)),
                    misses_first_attempts: usize::from(index % 100 >= 96),
                    answers_ping: !gone && index % 100 < 45 && index % 100 >= 17,
                },
            );
        }
        (table, hosts)
    }

    fn present_ips(decisions: &[PresenceDecision]) -> HashSet<Ipv4Addr> {
        decisions.iter().filter(|decision| decision.present_mac().is_some()).map(|decision| decision.ip).collect()
    }

    #[test]
    fn a_device_left_in_the_arp_table_that_does_not_answer_is_absent() {
        let phone = ip("192.168.0.100");
        let table = HashMap::from([(phone, "82-dc-10-19-ea-cf".to_string())]);
        let silent = Host { arp_delay: None, misses_first_attempts: 0, answers_ping: false };
        let network = Arc::new(SimulatedNetwork::new(table.clone(), table, HashMap::from([(phone, silent)])));

        let (decisions, _) = simulated::run(network, ip("192.168.0.101"), ip("255.255.255.0"));

        assert!(present_ips(&decisions).is_empty());
        assert_eq!(decisions[0].reason(), "no respondió ni ARP ni ping: estaba en la tabla de antes");
    }

    #[test]
    fn a_sleeping_phone_that_misses_the_first_arp_is_still_present() {
        let phone = ip("192.168.0.100");
        let table = HashMap::from([(phone, "82-dc-10-19-ea-cf".to_string())]);
        let sleepy = Host { arp_delay: Some(Duration::from_millis(3100)), misses_first_attempts: 1, answers_ping: false };
        let network = Arc::new(SimulatedNetwork::new(table.clone(), table, HashMap::from([(phone, sleepy)])));

        let (decisions, _) = simulated::run(network, ip("192.168.0.101"), ip("255.255.255.0"));

        assert_eq!(present_ips(&decisions), HashSet::from([phone]));
        assert_eq!(decisions[0].arp_attempts, 2);
    }

    #[test]
    fn a_phone_that_ignores_arp_but_answers_a_direct_ping_is_present_with_its_table_mac() {
        let phone = ip("192.168.0.100");
        let table = HashMap::from([(phone, "82-dc-10-19-ea-cf".to_string())]);
        let pings_only = Host { arp_delay: None, misses_first_attempts: 0, answers_ping: true };
        let network = Arc::new(SimulatedNetwork::new(table.clone(), table, HashMap::from([(phone, pings_only)])));

        let (decisions, _) = simulated::run(network, ip("192.168.0.101"), ip("255.255.255.0"));

        assert_eq!(decisions[0].present_mac().as_deref(), Some("82-dc-10-19-ea-cf"));
    }

    // Mejora aprobada: el ping directo va a la vez que el ARP, así que un celular que ignora el ARP se decide en
    // cuanto contesta el ping, sin esperar los intentos de ARP (~7,4 s reales).
    #[test]
    fn a_phone_that_only_answers_the_direct_ping_is_decided_without_waiting_for_arp() {
        let phone = ip("192.168.0.100");
        let table = HashMap::from([(phone, "82-dc-10-19-ea-cf".to_string())]);
        let pings_only = Host { arp_delay: None, misses_first_attempts: 0, answers_ping: true };
        let network = Arc::new(SimulatedNetwork::new(table.clone(), table, HashMap::from([(phone, pings_only)])));

        let (decisions, _) = simulated::run(network, ip("192.168.0.101"), ip("255.255.255.0"));

        assert_eq!(decisions[0].evidence, Some(PresenceEvidence::DirectPing));
        assert!(decisions[0].elapsed < simulated::scaled(simulated::SENDARP_GIVE_UP), "{:?}", decisions[0].elapsed);
    }

    #[test]
    fn a_device_that_answers_both_reports_the_mac_from_its_arp_answer() {
        let device = ip("192.168.0.110");
        let table = HashMap::from([(device, "aa-aa-aa-aa-aa-aa".to_string())]);
        let fast_arp = Host { arp_delay: Some(Duration::from_millis(10)), misses_first_attempts: 0, answers_ping: false };
        let network = Arc::new(SimulatedNetwork::new(table.clone(), table, HashMap::from([(device, fast_arp)])));

        let (decisions, _) = simulated::run(network, ip("192.168.0.101"), ip("255.255.255.0"));

        assert_eq!(decisions[0].evidence, Some(PresenceEvidence::Arp));
        assert_eq!(decisions[0].present_mac(), Some(simulated::mac_for(device)));
    }

    #[test]
    fn a_device_that_appears_during_the_scan_is_counted_without_a_second_arp() {
        let newcomer = ip("192.168.0.120");
        let after = HashMap::from([(newcomer, simulated::mac_for(newcomer))]);
        let network = Arc::new(SimulatedNetwork::new(HashMap::new(), after, HashMap::new()));

        let (decisions, _) = simulated::run(network.clone(), ip("192.168.0.101"), ip("255.255.255.0"));

        assert_eq!(present_ips(&decisions), HashSet::from([newcomer]));
        assert_eq!(decisions[0].evidence, Some(PresenceEvidence::AppearedDuringScan));
        assert_eq!(network.max_in_flight.load(std::sync::atomic::Ordering::SeqCst), 0);
    }

    // Requisito de la demostración: con ~450 equipos el escaneo manual termina en unos 20 s como máximo y con
    // las confirmaciones ARP acotadas.
    #[test]
    fn a_manual_scan_of_450_devices_finishes_within_20_seconds_with_bounded_concurrency() {
        let (table, hosts) = university_like_network(450, &HashSet::new());
        let network = Arc::new(SimulatedNetwork::new(table.clone(), table, hosts));

        let (decisions, simulated_elapsed) = simulated::run(network.clone(), ip(LOCAL_IP), ip(UNIVERSITY_MASK));

        println!("450 equipos: {} presentes en {simulated_elapsed:.1?} (tiempo real equivalente)", present_ips(&decisions).len());
        assert!(simulated_elapsed <= Duration::from_secs(20), "tardó {simulated_elapsed:?}");
        let limit = PresenceScanLimits::default().arp_concurrency;
        assert!(network.max_in_flight.load(std::sync::atomic::Ordering::SeqCst) <= limit);
    }

    // La demostración: entre dos escaneos manuales se desconectan 6 equipos de 450 y el conteo baja exactamente 6.
    #[test]
    fn six_devices_leaving_between_two_manual_scans_drop_the_count_by_six() {
        let (table, hosts) = university_like_network(450, &HashSet::new());
        let first = Arc::new(SimulatedNetwork::new(table.clone(), table.clone(), hosts));
        let (before, _) = simulated::run(first, ip(LOCAL_IP), ip(UNIVERSITY_MASK));

        let leaving: HashSet<usize> = [20, 90, 150, 222, 345, 444].into();
        let (table, hosts) = university_like_network(450, &leaving);
        let second = Arc::new(SimulatedNetwork::new(table.clone(), table, hosts));
        let (after, _) = simulated::run(second, ip(LOCAL_IP), ip(UNIVERSITY_MASK));

        let gone: HashSet<Ipv4Addr> = present_ips(&before).difference(&present_ips(&after)).copied().collect();
        assert_eq!(gone, leaving.iter().map(|index| university_ip(*index)).collect());
        assert_eq!(present_ips(&before).len() - present_ips(&after).len(), 6);
    }

    /// Prueba manual en la red real (solo en una red propia): `cargo test --lib presence_scan_on_this_network -- --ignored --nocapture`.
    #[test]
    #[ignore]
    fn presence_scan_on_this_network() {
        let runtime = tokio::runtime::Builder::new_current_thread().enable_all().build().unwrap();
        let devices = runtime.block_on(scan_present_devices_with(PresenceScanLimits::from_env(), true)).unwrap();
        println!("{} dispositivos", devices.len());
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
        // Bytes reales de ipconfig en español (CP850): 0xA2 es 'ó' y no es UTF-8 válido; antes rompía "Dirección IPv4".
        let cp850_bytes = [b'D', b'i', b'r', b'e', b'c', b'c', b'i', 0xA2, b'n'];
        assert_eq!(decode_console_output(&cp850_bytes), "Direcci\u{f3}n");
    }
}

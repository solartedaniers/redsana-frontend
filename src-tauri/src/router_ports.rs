use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::time::Duration;

use serde::Serialize;
use tokio::net::TcpStream;
use tokio::task::JoinSet;

use crate::console_command::hidden_console_command;

const ROUTE_COMMAND: &str = "route";
const ROUTE_PRINT_IPV4_ARGS: [&str; 2] = ["print", "-4"];
const DEFAULT_ROUTE: &str = "0.0.0.0";

/// Puertos TCP de riesgo conocido en un router doméstico. Espejo intencional de
/// RISKY_ROUTER_PORTS en backend/app/domain/security_analyzers.py, que decide
/// cuánto penaliza cada uno: aquí solo se comprueba si están abiertos.
const PROBED_PORTS: [u16; 6] = [21, 22, 23, 139, 445, 7547];

/// Un puerto que no acepta conexión en este tiempo se considera cerrado/filtrado.
const CONNECT_TIMEOUT: Duration = Duration::from_millis(800);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RouterPortScan {
    pub gateway: String,
    pub open_ports: Vec<u16>,
}

/// Comprueba qué puertos de riesgo acepta conexiones en el router (la puerta de
/// enlace predeterminada) y en ningún otro equipo: es una conexión TCP normal
/// por puerto, sin enviar datos, contra el router de la propia red del usuario.
#[tauri::command]
pub async fn scan_router_open_ports() -> Result<RouterPortScan, String> {
    let route_table = tokio::task::spawn_blocking(run_route_print)
        .await
        .map_err(|e| format!("no se pudo ejecutar route: {e}"))??;
    let gateway = parse_default_gateway(&route_table).ok_or("no se encontró la puerta de enlace predeterminada")?;

    let mut probes = JoinSet::new();
    for port in PROBED_PORTS {
        probes.spawn(async move { is_port_open(gateway, port).await.then_some(port) });
    }
    let mut open_ports: Vec<u16> = probes.join_all().await.into_iter().flatten().collect();
    open_ports.sort_unstable();

    Ok(RouterPortScan { gateway: gateway.to_string(), open_ports })
}

async fn is_port_open(host: Ipv4Addr, port: u16) -> bool {
    let address = SocketAddr::new(IpAddr::V4(host), port);
    matches!(tokio::time::timeout(CONNECT_TIMEOUT, TcpStream::connect(address)).await, Ok(Ok(_)))
}

fn run_route_print() -> Result<String, String> {
    let output = hidden_console_command(ROUTE_COMMAND)
        .args(ROUTE_PRINT_IPV4_ARGS)
        .output()
        .map_err(|e| format!("no se pudo lanzar route: {e}"))?;
    if !output.status.success() {
        return Err("route print devolvió un error".to_string());
    }
    // Solo se leen IPs y números, que no dependen del idioma ni de la página de códigos.
    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

/// Ruta por defecto (destino y máscara 0.0.0.0) con la menor métrica: es la
/// que Windows usa de verdad cuando hay varios adaptadores con gateway.
fn parse_default_gateway(route_table: &str) -> Option<Ipv4Addr> {
    route_table
        .lines()
        .filter_map(|line| {
            let columns: Vec<&str> = line.split_whitespace().collect();
            match columns.as_slice() {
                [DEFAULT_ROUTE, DEFAULT_ROUTE, gateway, _interface, metric, ..] => {
                    Some((metric.parse::<u32>().ok()?, gateway.parse::<Ipv4Addr>().ok()?))
                }
                _ => None,
            }
        })
        .min_by_key(|(metric, _)| *metric)
        .map(|(_, gateway)| gateway)
}

#[cfg(test)]
mod tests {
    use super::*;

    const ROUTE_TABLE: &str = "\
IPv4 Route Table
===========================================================================
Active Routes:
Network Destination        Netmask          Gateway       Interface  Metric
          0.0.0.0          0.0.0.0      192.168.0.1    192.168.0.103     45
          0.0.0.0          0.0.0.0       10.0.0.1         10.0.0.20     25
        127.0.0.0        255.0.0.0         On-link         127.0.0.1    331
===========================================================================
Persistent Routes:
  None
";

    #[test]
    fn picks_the_default_route_with_the_lowest_metric() {
        assert_eq!(parse_default_gateway(ROUTE_TABLE), Some(Ipv4Addr::new(10, 0, 0, 1)));
    }

    #[test]
    fn ignores_on_link_and_non_default_routes() {
        let table = "        0.0.0.0          0.0.0.0         On-link     192.168.0.103     45\n";
        assert_eq!(parse_default_gateway(table), None);
    }

    fn block_on<F: std::future::Future>(future: F) -> F::Output {
        tokio::runtime::Builder::new_current_thread().enable_all().build().unwrap().block_on(future)
    }

    #[test]
    fn a_closed_port_is_reported_as_closed() {
        // Puerto 9 (discard) en loopback: no hay servicio en Windows, el connect falla.
        assert!(!block_on(is_port_open(Ipv4Addr::LOCALHOST, 9)));
    }

    #[test]
    fn an_open_port_is_reported_as_open() {
        block_on(async {
            let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
            let port = listener.local_addr().unwrap().port();
            assert!(is_port_open(Ipv4Addr::LOCALHOST, port).await);
        });
    }
}

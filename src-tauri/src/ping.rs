use std::net::IpAddr;
use std::time::Duration;

use serde::Serialize;
use surge_ping::{Client, Config, PingIdentifier, PingSequence, SurgeError, ICMP};
use tokio::net::lookup_host;

/// Host de referencia para medir la calidad de la red cuando el llamador no especifica uno.
const DEFAULT_PING_TARGET: &str = "1.1.1.1";
/// Cantidad de pings de muestra por medición: suficiente para estimar jitter sin tardar demasiado.
const QUALITY_SAMPLE_COUNT: u16 = 5;
/// Espera entre cada ping de la muestra, para no saturar la red ni el hilo.
const QUALITY_SAMPLE_INTERVAL: Duration = Duration::from_millis(200);
/// Tiempo máximo de espera por cada ping antes de contarlo como paquete perdido.
const PING_TIMEOUT: Duration = Duration::from_secs(1);
/// Tamaño del payload ICMP en bytes (sin datos reales, solo para completar el paquete).
const PING_PAYLOAD_SIZE: usize = 8;

/// Resultado agregado de una medición de calidad de red (varios pings reales).
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkQualityMeasurement {
    pub latency_ms: f64,
    pub jitter_ms: f64,
    pub packet_loss_percent: f64,
}

/// Envía un único ICMP echo real al host indicado y devuelve la latencia en milisegundos.
/// Acepta tanto IPs como hostnames (se resuelven vía DNS antes del ping).
#[tauri::command]
pub async fn measure_latency(host: String) -> Result<f64, String> {
    let address = resolve_host(&host).await?;
    let client = new_client(address)?;

    ping_once(&client, address, 0)
        .await?
        .ok_or_else(|| format!("ping a {host} superó el tiempo de espera"))
}

/// Mide latencia, jitter y pérdida de paquetes reales, enviando varios pings
/// al host en una ventana corta de tiempo.
#[tauri::command]
pub async fn measure_network_quality(host: Option<String>) -> Result<NetworkQualityMeasurement, String> {
    let target = host.unwrap_or_else(|| DEFAULT_PING_TARGET.to_string());
    let address = resolve_host(&target).await?;
    let client = new_client(address)?;

    let mut latencies_ms: Vec<f64> = Vec::with_capacity(QUALITY_SAMPLE_COUNT as usize);
    for sequence in 0..QUALITY_SAMPLE_COUNT {
        if let Some(latency_ms) = ping_once(&client, address, sequence).await? {
            latencies_ms.push(latency_ms);
        }
        tokio::time::sleep(QUALITY_SAMPLE_INTERVAL).await;
    }

    Ok(aggregate_samples(&latencies_ms, QUALITY_SAMPLE_COUNT))
}

/// Crea el cliente ICMP apropiado para la familia de direcciones del host resuelto.
fn new_client(address: IpAddr) -> Result<Client, String> {
    let config = match address {
        IpAddr::V4(_) => Config::default(),
        IpAddr::V6(_) => Config::builder().kind(ICMP::V6).build(),
    };
    Client::new(&config).map_err(|e| format!("no se pudo crear el cliente ICMP: {e}"))
}

/// Envía un ping y devuelve la latencia, o None si se agotó el timeout (paquete perdido).
async fn ping_once(client: &Client, address: IpAddr, sequence: u16) -> Result<Option<f64>, String> {
    let mut pinger = client.pinger(address, PingIdentifier(sequence)).await;
    pinger.timeout(PING_TIMEOUT);
    let payload = [0u8; PING_PAYLOAD_SIZE];

    match pinger.ping(PingSequence(sequence), &payload).await {
        Ok((_packet, duration)) => Ok(Some(duration_to_ms(duration))),
        Err(SurgeError::Timeout { .. }) => Ok(None),
        Err(e) => Err(format!("ping falló: {e}")),
    }
}

/// Calcula latencia promedio, jitter (desviación media entre pings consecutivos) y
/// porcentaje de pérdida de paquetes a partir de las muestras recolectadas.
fn aggregate_samples(latencies_ms: &[f64], expected_samples: u16) -> NetworkQualityMeasurement {
    let received = latencies_ms.len();
    let packet_loss_percent = if expected_samples == 0 {
        0.0
    } else {
        100.0 * (expected_samples as f64 - received as f64) / expected_samples as f64
    };

    if received == 0 {
        return NetworkQualityMeasurement {
            latency_ms: 0.0,
            jitter_ms: 0.0,
            packet_loss_percent,
        };
    }

    let latency_ms = latencies_ms.iter().sum::<f64>() / received as f64;

    let jitter_ms = if received < 2 {
        0.0
    } else {
        let deltas: Vec<f64> = latencies_ms.windows(2).map(|pair| (pair[1] - pair[0]).abs()).collect();
        deltas.iter().sum::<f64>() / deltas.len() as f64
    };

    NetworkQualityMeasurement {
        latency_ms,
        jitter_ms,
        packet_loss_percent,
    }
}

async fn resolve_host(host: &str) -> Result<IpAddr, String> {
    if let Ok(ip) = host.parse::<IpAddr>() {
        return Ok(ip);
    }

    // lookup_host necesita un puerto aunque no se use para ICMP.
    lookup_host((host, 0))
        .await
        .map_err(|e| format!("no se pudo resolver {host}: {e}"))?
        .next()
        .map(|socket_addr| socket_addr.ip())
        .ok_or_else(|| format!("{host} no resolvió a ninguna dirección"))
}

fn duration_to_ms(duration: Duration) -> f64 {
    duration.as_secs_f64() * 1000.0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn aggregate_samples_computes_average_latency() {
        let result = aggregate_samples(&[10.0, 20.0, 30.0], 3);
        assert_eq!(result.latency_ms, 20.0);
    }

    #[test]
    fn aggregate_samples_computes_jitter_as_mean_consecutive_delta() {
        let result = aggregate_samples(&[10.0, 20.0, 15.0], 3);
        // deltas: |20-10|=10, |15-20|=5 -> promedio 7.5
        assert_eq!(result.jitter_ms, 7.5);
    }

    #[test]
    fn aggregate_samples_computes_packet_loss_percent() {
        let result = aggregate_samples(&[10.0, 20.0], 4);
        assert_eq!(result.packet_loss_percent, 50.0);
    }

    #[test]
    fn aggregate_samples_handles_total_loss_without_dividing_by_zero() {
        let result = aggregate_samples(&[], 5);
        assert_eq!(result.packet_loss_percent, 100.0);
        assert_eq!(result.latency_ms, 0.0);
        assert_eq!(result.jitter_ms, 0.0);
    }

    #[test]
    fn aggregate_samples_single_sample_has_no_jitter() {
        let result = aggregate_samples(&[42.0], 1);
        assert_eq!(result.jitter_ms, 0.0);
        assert_eq!(result.packet_loss_percent, 0.0);
    }
}

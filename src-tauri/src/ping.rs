use std::net::IpAddr;
use std::time::Duration;

use serde::Serialize;
use surge_ping::{Client, Config, PingIdentifier, PingSequence, SurgeError, ICMP};
use tokio::net::lookup_host;

use crate::lan_scan::current_gateway;

/// Host de referencia cuando el llamador no indica uno.
const DEFAULT_PING_TARGET: &str = "1.1.1.1";
/// Pings por medición: suficientes para estimar el jitter sin tardar demasiado.
const QUALITY_SAMPLE_COUNT: u16 = 5;
/// Espera entre pings para no saturar la red ni el hilo.
const QUALITY_SAMPLE_INTERVAL: Duration = Duration::from_millis(200);
/// Espera máxima por ping antes de contarlo como perdido.
const PING_TIMEOUT: Duration = Duration::from_secs(1);
/// Tamaño del payload ICMP en bytes (relleno, sin datos reales).
const PING_PAYLOAD_SIZE: usize = 8;
/// Espera por ping al router, en ms; se cambia con esta variable de entorno para routers lentos.
const GATEWAY_PING_TIMEOUT_ENV: &str = "REDSANA_GATEWAY_PING_TIMEOUT_MS";
const DEFAULT_GATEWAY_PING_TIMEOUT: Duration = Duration::from_millis(1000);

/// Resultado agregado de una medición con varios pings reales.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkQualityMeasurement {
    pub latency_ms: f64,
    pub jitter_ms: f64,
    pub packet_loss_percent: f64,
    /// Latencia al router; None sin router o si no respondió a ningún ping (no es un error de la medición).
    pub gateway_latency_ms: Option<f64>,
}

/// Envía un ICMP echo real y devuelve la latencia en ms; acepta IPs y nombres (los resuelve por DNS).
#[tauri::command]
pub async fn measure_latency(host: String) -> Result<f64, String> {
    let address = resolve_host(&host).await?;
    let client = new_client(address)?;

    ping_once(&client, address, 0, PING_TIMEOUT)
        .await?
        .ok_or_else(|| format!("ping a {host} superó el tiempo de espera"))
}

/// Mide latencia, jitter y pérdida reales con varios pings en una ventana corta.
#[tauri::command]
pub async fn measure_network_quality(host: Option<String>) -> Result<NetworkQualityMeasurement, String> {
    let target = host.unwrap_or_else(|| DEFAULT_PING_TARGET.to_string());
    let address = resolve_host(&target).await?;
    let client = new_client(address)?;

    // Router e internet en el mismo ciclo y en paralelo: la medición no tarda más que antes.
    let gateway = tokio::spawn(measure_gateway_latency());
    let internet = ping_series(&client, address, PING_TIMEOUT).await;
    let gateway_latency_ms = gateway.await.unwrap_or_default();
    let mut measurement = summarize_pings(internet)?;
    measurement.gateway_latency_ms = gateway_latency_ms;
    Ok(measurement)
}

async fn ping_series(
    client: &Client,
    address: IpAddr,
    timeout: Duration,
) -> Vec<Result<Option<f64>, String>> {
    let mut results = Vec::with_capacity(QUALITY_SAMPLE_COUNT as usize);
    for sequence in 0..QUALITY_SAMPLE_COUNT {
        results.push(ping_once(client, address, sequence, timeout).await);
        tokio::time::sleep(QUALITY_SAMPLE_INTERVAL).await;
    }
    results
}

/// Sin router o sin respuesta no falla: la latencia al router queda ausente y el backend no diagnostica.
async fn measure_gateway_latency() -> Option<f64> {
    let gateway = IpAddr::V4(current_gateway().await?);
    let client = new_client(gateway).map_err(|e| log::warn!("{e}")).ok()?;
    let timeout = gateway_ping_timeout(std::env::var(GATEWAY_PING_TIMEOUT_ENV).ok().as_deref());
    average_latency(&ping_series(&client, gateway, timeout).await)
}

/// Milisegundos positivos de la variable; vacía, cero o inválida deja el valor por defecto.
fn gateway_ping_timeout(raw: Option<&str>) -> Duration {
    raw.and_then(|value| value.trim().parse::<u64>().ok())
        .filter(|ms| *ms > 0)
        .map(Duration::from_millis)
        .unwrap_or(DEFAULT_GATEWAY_PING_TIMEOUT)
}

/// Promedio de las respuestas; None si ningún ping respondió.
fn average_latency(results: &[Result<Option<f64>, String>]) -> Option<f64> {
    let replies: Vec<f64> = results
        .iter()
        .filter_map(|result| result.as_ref().ok().copied().flatten())
        .collect();
    (!replies.is_empty()).then(|| replies.iter().sum::<f64>() / replies.len() as f64)
}

/// Si todos los envíos fallan (el PC sin red local: al despertar o al cambiar de WiFi) es un error y no se guarda nada,
/// como en el 0.1.5: no es un corte del proveedor. Un ping agotado por tiempo, o un envío fallido suelto, sí cuenta
/// como perdido; así un corte real con el WiFi conectado sigue siendo 100 % de pérdida.
fn summarize_pings(
    results: Vec<Result<Option<f64>, String>>,
) -> Result<NetworkQualityMeasurement, String> {
    let expected_samples = results.len() as u16;
    if let Some(Err(first_error)) = results.first() {
        if results.iter().all(Result::is_err) {
            return Err(first_error.clone());
        }
    }
    let latencies_ms: Vec<f64> = results
        .into_iter()
        .filter_map(|result| {
            result.unwrap_or_else(|e| {
                log::warn!("{e}");
                None
            })
        })
        .collect();
    Ok(aggregate_samples(&latencies_ms, expected_samples))
}

/// Crea el cliente ICMP según la familia de la dirección; lan_scan.rs también lo reutiliza.
pub(crate) fn new_client(address: IpAddr) -> Result<Client, String> {
    let config = match address {
        IpAddr::V4(_) => Config::default(),
        IpAddr::V6(_) => Config::builder().kind(ICMP::V6).build(),
    };
    Client::new(&config).map_err(|e| format!("no se pudo crear el cliente ICMP: {e}"))
}

/// Envía un ping y devuelve la latencia, o None si se agotó el timeout.
async fn ping_once(
    client: &Client,
    address: IpAddr,
    sequence: u16,
    timeout: Duration,
) -> Result<Option<f64>, String> {
    let mut pinger = client.pinger(address, PingIdentifier(sequence)).await;
    pinger.timeout(timeout);
    let payload = [0u8; PING_PAYLOAD_SIZE];

    match pinger.ping(PingSequence(sequence), &payload).await {
        Ok((_packet, duration)) => Ok(Some(duration_to_ms(duration))),
        Err(SurgeError::Timeout { .. }) => Ok(None),
        Err(e) => Err(format!("ping falló: {e}")),
    }
}

/// Latencia promedio, jitter (diferencia media entre pings seguidos) y porcentaje de pérdida.
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
            gateway_latency_ms: None,
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
        gateway_latency_ms: None,
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

    fn send_failed() -> Result<Option<f64>, String> {
        Err("ping falló: red inalcanzable".to_string())
    }

    #[test]
    fn every_ping_failing_to_send_is_an_error_and_nothing_is_saved() {
        let results = (0..QUALITY_SAMPLE_COUNT).map(|_| send_failed()).collect();
        assert_eq!(
            summarize_pings(results).err().as_deref(),
            Some("ping falló: red inalcanzable")
        );
    }

    #[test]
    fn every_ping_timing_out_still_counts_as_total_loss() {
        let results = (0..QUALITY_SAMPLE_COUNT).map(|_| Ok(None)).collect();
        let measurement =
            summarize_pings(results).expect("un agotamiento por tiempo es una medición");
        assert_eq!(measurement.packet_loss_percent, 100.0);
    }

    #[test]
    fn a_single_failed_send_counts_as_a_lost_ping() {
        let results = vec![
            Ok(Some(10.0)),
            send_failed(),
            Ok(Some(20.0)),
            Ok(None),
            Ok(Some(30.0)),
        ];
        let measurement = summarize_pings(results).expect("hubo respuestas");
        assert_eq!(measurement.packet_loss_percent, 40.0);
        assert_eq!(measurement.latency_ms, 20.0);
    }

    #[test]
    fn gateway_latency_is_the_average_of_the_replies() {
        let results = vec![Ok(Some(2.0)), Ok(None), send_failed(), Ok(Some(4.0))];
        assert_eq!(average_latency(&results), Some(3.0));
    }

    #[test]
    fn a_gateway_that_never_answers_is_absent_not_an_error() {
        let results = vec![Ok(None), send_failed(), Ok(None)];
        assert_eq!(average_latency(&results), None);
    }

    #[test]
    fn gateway_timeout_comes_from_the_variable_or_the_default() {
        let cases = [
            (Some("250"), Duration::from_millis(250)),
            (Some(" 0 "), DEFAULT_GATEWAY_PING_TIMEOUT),
            (Some("abc"), DEFAULT_GATEWAY_PING_TIMEOUT),
            (None, DEFAULT_GATEWAY_PING_TIMEOUT),
        ];
        for (raw, expected) in cases {
            assert_eq!(gateway_ping_timeout(raw), expected);
        }
    }

    #[test]
    fn a_missing_gateway_latency_serializes_as_null() {
        let json = serde_json::to_value(aggregate_samples(&[10.0], 1)).expect("serializa");
        assert_eq!(json["gatewayLatencyMs"], serde_json::Value::Null);
    }

    #[test]
    fn aggregate_samples_single_sample_has_no_jitter() {
        let result = aggregate_samples(&[42.0], 1);
        assert_eq!(result.jitter_ms, 0.0);
        assert_eq!(result.packet_loss_percent, 0.0);
    }
}

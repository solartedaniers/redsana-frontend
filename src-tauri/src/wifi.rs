use crate::console_command::hidden_console_command;

const NETSH_COMMAND: &str = "netsh";
const NETSH_SHOW_INTERFACES_ARGS: [&str; 3] = ["wlan", "show", "interfaces"];
/// Etiquetas del tipo de autenticación según el idioma. Coincidencia exacta: "Autenticación 802.1x" es otro campo.
const NETSH_AUTH_FIELD_LABELS: [&str; 2] = ["Autenticación", "Authentication"];

/// Lee el cifrado real de la red WiFi actual con `netsh wlan show interfaces`.
#[tauri::command]
pub async fn get_wifi_encryption() -> Result<String, String> {
    // netsh bloquea, así que lo corro fuera del runtime async de tokio.
    tokio::task::spawn_blocking(run_netsh_show_interfaces)
        .await
        .map_err(|e| format!("no se pudo ejecutar netsh: {e}"))?
}

fn run_netsh_show_interfaces() -> Result<String, String> {
    let output = hidden_console_command(NETSH_COMMAND)
        .args(NETSH_SHOW_INTERFACES_ARGS)
        .output()
        .map_err(|e| format!("no se pudo lanzar netsh: {e}"))?;

    if !output.status.success() {
        return Err("netsh wlan show interfaces devolvió un error".to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_auth_type(&stdout).ok_or_else(|| "no se encontró el campo de autenticación en la salida de netsh".to_string())
}

/// Busca la línea cuya etiqueta coincide exactamente con una de las conocidas y devuelve su valor.
fn parse_auth_type(netsh_output: &str) -> Option<String> {
    netsh_output.lines().find_map(|line| {
        let (label, value) = line.split_once(':')?;
        let label = label.trim();
        if NETSH_AUTH_FIELD_LABELS.contains(&label) {
            Some(value.trim().to_string())
        } else {
            None
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    // Muestra real de netsh en español, con el campo "Autenticación 802.1x" que no debe confundirse.
    const SAMPLE_OUTPUT: &str = "\
Hay 1 interfaz en el sistema:

    Nombre                   : Wi-Fi
    Descripción              : Intel(R) Wi-Fi 6 AX201 160MHz
    Estado                   : conectado
    SSID                     : MyHomeNetwork
    Tipo de red              : Infraestructura
    Autenticación 802.1x     : Desactivada
    Autenticación            : WPA2-Personal
    Cifrado                  : CCMP
    Modo de conexión         : Automático
    Canal                    : 6
";

    #[test]
    fn parse_auth_type_ignores_decoy_8021x_field() {
        assert_eq!(parse_auth_type(SAMPLE_OUTPUT), Some("WPA2-Personal".to_string()));
    }

    #[test]
    fn parse_auth_type_returns_none_when_field_missing() {
        assert_eq!(parse_auth_type("SSID : MyNetwork\nCanal : 6"), None);
    }

    #[test]
    fn parse_auth_type_supports_english_windows_locale() {
        let output = "SSID : MyNetwork\nAuthentication : WPA3-Personal\n";
        assert_eq!(parse_auth_type(output), Some("WPA3-Personal".to_string()));
    }
}

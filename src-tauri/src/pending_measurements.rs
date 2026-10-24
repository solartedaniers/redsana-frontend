//! Cola local de mediciones que no se pudieron enviar: un archivo JSON en la carpeta de datos de la app
//! (%APPDATA%\com.redsana.desktop en Windows), así sobrevive a cerrar la app. El frontend decide qué guardar;
//! aquí solo se lee y se escribe, fuera del hilo de la interfaz.

use std::fs;
use std::path::{Path, PathBuf};

use serde_json::Value;
use tauri::{AppHandle, Manager};

const QUEUE_FILE_NAME: &str = "pending-measurements.json";

#[tauri::command]
pub async fn load_pending_measurements(app: AppHandle) -> Result<Vec<Value>, String> {
    let path = queue_path(&app)?;
    tauri::async_runtime::spawn_blocking(move || read_queue(&path))
        .await
        .map_err(|e| format!("no se pudo leer la cola: {e}"))?
}

#[tauri::command]
pub async fn save_pending_measurements(app: AppHandle, items: Vec<Value>) -> Result<(), String> {
    let path = queue_path(&app)?;
    tauri::async_runtime::spawn_blocking(move || write_queue(&path, &items))
        .await
        .map_err(|e| format!("no se pudo guardar la cola: {e}"))?
}

fn queue_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("sin carpeta de datos de la app: {e}"))?;
    Ok(dir.join(QUEUE_FILE_NAME))
}

/// Sin archivo, la cola está vacía; un archivo dañado también cuenta como vacío para no trabar las mediciones.
fn read_queue(path: &Path) -> Result<Vec<Value>, String> {
    match fs::read_to_string(path) {
        Ok(text) => Ok(serde_json::from_str(&text).unwrap_or_else(|e| {
            log::warn!("cola local ilegible, se descarta: {e}");
            Vec::new()
        })),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Vec::new()),
        Err(e) => Err(format!("no se pudo leer {}: {e}", path.display())),
    }
}

/// Escribe en un temporal y lo renombra: si la app se cierra a mitad, queda el archivo anterior entero.
fn write_queue(path: &Path, items: &[Value]) -> Result<(), String> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| format!("no se pudo crear {}: {e}", dir.display()))?;
    }
    let text =
        serde_json::to_string(items).map_err(|e| format!("no se pudo serializar la cola: {e}"))?;
    let temporary = path.with_extension("json.tmp");
    fs::write(&temporary, text)
        .map_err(|e| format!("no se pudo escribir {}: {e}", temporary.display()))?;
    fs::rename(&temporary, path)
        .map_err(|e| format!("no se pudo reemplazar {}: {e}", path.display()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn scratch_dir(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("redsana-queue-test-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        dir
    }

    #[test]
    fn missing_file_is_an_empty_queue() {
        let dir = scratch_dir("missing");
        assert!(read_queue(&dir.join(QUEUE_FILE_NAME)).unwrap().is_empty());
    }

    #[test]
    fn written_queue_reads_back_in_the_same_order() {
        let dir = scratch_dir("roundtrip");
        let path = dir.join(QUEUE_FILE_NAME);
        let items = vec![
            json!({"recordedAt": "2026-10-24T10:00:00.000Z"}),
            json!({"recordedAt": "2026-10-24T10:01:00.000Z"}),
        ];

        write_queue(&path, &items).unwrap();

        assert_eq!(read_queue(&path).unwrap(), items);
        assert!(!path.with_extension("json.tmp").exists());
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn rewriting_replaces_the_previous_queue() {
        let dir = scratch_dir("replace");
        let path = dir.join(QUEUE_FILE_NAME);
        write_queue(&path, &[json!(1), json!(2)]).unwrap();

        write_queue(&path, &[json!(2)]).unwrap();

        assert_eq!(read_queue(&path).unwrap(), vec![json!(2)]);
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn a_damaged_file_counts_as_empty() {
        let dir = scratch_dir("damaged");
        let path = dir.join(QUEUE_FILE_NAME);
        fs::create_dir_all(&dir).unwrap();
        fs::write(&path, "{no es json").unwrap();

        assert!(read_queue(&path).unwrap().is_empty());
        fs::remove_dir_all(&dir).unwrap();
    }
}

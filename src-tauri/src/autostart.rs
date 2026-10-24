//! Inicio con Windows (plugin oficial tauri-plugin-autostart). Apagado por defecto: solo el interruptor del perfil
//! llama a set_autostart. Al arrancar con Windows la app empieza oculta en la bandeja y mide.

use tauri::{AppHandle, Manager};
use tauri_plugin_autostart::ManagerExt;

/// Argumento con que Windows abre la app al iniciar sesión.
pub const AUTOSTART_ARG: &str = "--autostart";
const MAIN_WINDOW: &str = "main";

pub fn launched_by_autostart() -> bool {
  std::env::args().any(|arg| arg == AUTOSTART_ARG)
}

/// La ventana nace oculta (tauri.conf.json): se muestra salvo que la haya abierto Windows al iniciar sesión.
pub fn show_window_unless_autostart(app: &AppHandle) {
  if launched_by_autostart() {
    return;
  }
  if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
    if let Err(e) = window.show() {
      log::warn!("no se pudo mostrar la ventana: {e}");
    }
  }
}

/// El frontend reintenta la sesión sin pedir "Reintentar" cuando la abrió Windows (el WiFi tarda en conectarse).
#[tauri::command]
pub fn is_autostart_launch() -> bool {
  launched_by_autostart()
}

#[tauri::command]
pub fn autostart_enabled(app: AppHandle) -> Result<bool, String> {
  app.autolaunch().is_enabled().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_autostart(app: AppHandle, enabled: bool) -> Result<(), String> {
  let launcher = app.autolaunch();
  if enabled {
    return launcher.enable().map_err(|e| e.to_string());
  }
  let name = &app.package_info().name;
  // El plugin falla si la entrada ya no existe (por ejemplo, borrada a mano).
  if registry::run_entry_exists(name) {
    launcher.disable().map_err(|e| e.to_string())?;
  }
  // El plugin deja la marca del Administrador de tareas; la borro para no dejar rastro.
  registry::delete_startup_approved(name);
  Ok(())
}

#[cfg(windows)]
mod registry {
  const HKEY_CURRENT_USER: isize = 0x8000_0001_u32 as i32 as isize;
  const RUN_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
  const STARTUP_APPROVED_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run";
  const RRF_RT_ANY: u32 = 0x0000_ffff;
  const ERROR_SUCCESS: i32 = 0;

  #[link(name = "advapi32")]
  extern "system" {
    fn RegGetValueW(
      key: isize,
      sub_key: *const u16,
      value: *const u16,
      flags: u32,
      kind: *mut u32,
      data: *mut u8,
      size: *mut u32,
    ) -> i32;
    fn RegDeleteKeyValueW(key: isize, sub_key: *const u16, value: *const u16) -> i32;
  }

  fn wide(text: &str) -> Vec<u16> {
    text.encode_utf16().chain(std::iter::once(0)).collect()
  }

  pub fn run_entry_exists(name: &str) -> bool {
    let (key, value) = (wide(RUN_KEY), wide(name));
    let status = unsafe {
      RegGetValueW(
        HKEY_CURRENT_USER,
        key.as_ptr(),
        value.as_ptr(),
        RRF_RT_ANY,
        std::ptr::null_mut(),
        std::ptr::null_mut(),
        std::ptr::null_mut(),
      )
    };
    status == ERROR_SUCCESS
  }

  pub fn delete_startup_approved(name: &str) {
    let (key, value) = (wide(STARTUP_APPROVED_KEY), wide(name));
    // Si no existe no hay nada que borrar: el resultado no importa.
    unsafe { RegDeleteKeyValueW(HKEY_CURRENT_USER, key.as_ptr(), value.as_ptr()) };
  }
}

#[cfg(not(windows))]
mod registry {
  pub fn run_entry_exists(_name: &str) -> bool {
    true
  }

  pub fn delete_startup_approved(_name: &str) {}
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn a_normal_launch_is_not_an_autostart_launch() {
    // cargo test no pasa --autostart: la ventana se mostraría como siempre.
    assert!(!launched_by_autostart());
  }

  #[cfg(windows)]
  #[test]
  fn a_missing_run_entry_is_reported_as_absent() {
    assert!(!registry::run_entry_exists("RedSana-entrada-que-no-existe"));
  }
}

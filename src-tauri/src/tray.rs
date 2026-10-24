//! Bandeja del sistema: cerrar la ventana la oculta y la medición sigue; "Salir" cierra todo. Los textos llegan del
//! frontend (i18n), aquí no hay ninguno escrito.

use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use serde::Deserialize;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, CloseRequestApi, Manager, State, Window, Wry};

const TRAY_ID: &str = "main";
const MAIN_WINDOW: &str = "main";
const OPEN_ITEM_ID: &str = "open";
const QUIT_ITEM_ID: &str = "quit";
/// Marca en la carpeta de datos de la app: el aviso del primer cierre ya se mostró.
const NOTICE_SHOWN_FILE: &str = "tray-notice-shown";

/// Textos traducidos de la bandeja y del aviso del primer cierre.
#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TrayTexts {
  open: String,
  quit: String,
  tooltip: String,
  notice_title: String,
  notice_body: String,
}

/// Mientras la bandeja no exista, cerrar la ventana cierra la app como antes: nunca queda oculta sin forma de volver.
#[derive(Default)]
pub struct TrayState {
  installed: AtomicBool,
  texts: Mutex<Option<TrayTexts>>,
}

/// Crea la bandeja o, si ya existe (cambio de idioma), actualiza sus textos.
#[tauri::command]
pub fn install_tray(app: AppHandle, state: State<'_, TrayState>, texts: TrayTexts) -> Result<(), String> {
  let menu = build_menu(&app, &texts).map_err(|e| format!("no se pudo crear el menú de la bandeja: {e}"))?;
  if let Some(tray) = app.tray_by_id(TRAY_ID) {
    tray.set_menu(Some(menu)).map_err(|e| e.to_string())?;
    tray.set_tooltip(Some(&texts.tooltip)).map_err(|e| e.to_string())?;
  } else {
    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
      .menu(&menu)
      .tooltip(&texts.tooltip)
      .show_menu_on_left_click(false)
      .on_menu_event(|app, event| match event.id().as_ref() {
        OPEN_ITEM_ID => show_main_window(app),
        QUIT_ITEM_ID => app.exit(0),
        _ => {}
      })
      .on_tray_icon_event(|tray, event| {
        if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
          show_main_window(tray.app_handle());
        }
      });
    if let Some(icon) = app.default_window_icon() {
      builder = builder.icon(icon.clone());
    }
    builder.build(&app).map_err(|e| format!("no se pudo crear la bandeja: {e}"))?;
  }
  *state.texts.lock().map_err(|e| e.to_string())? = Some(texts);
  state.installed.store(true, Ordering::SeqCst);
  Ok(())
}

fn build_menu(app: &AppHandle, texts: &TrayTexts) -> tauri::Result<Menu<Wry>> {
  let open = MenuItem::with_id(app, OPEN_ITEM_ID, &texts.open, true, None::<&str>)?;
  let quit = MenuItem::with_id(app, QUIT_ITEM_ID, &texts.quit, true, None::<&str>)?;
  Menu::with_items(app, &[&open, &quit])
}

/// Con la bandeja instalada, cerrar solo oculta la ventana: la medición del WebView sigue corriendo.
pub fn on_close_requested(window: &Window, api: &CloseRequestApi) {
  let app = window.app_handle();
  let state = app.state::<TrayState>();
  if !state.installed.load(Ordering::SeqCst) {
    return;
  }
  api.prevent_close();
  if let Err(e) = window.hide() {
    log::warn!("no se pudo ocultar la ventana: {e}");
  }
  let texts = state.texts.lock().ok().and_then(|texts| texts.clone());
  let marker = app.path().app_data_dir().ok().map(|dir| dir.join(NOTICE_SHOWN_FILE));
  if let (Some(texts), Some(marker)) = (texts, marker) {
    if claim_first_notice(&marker) {
      // En otro hilo: el aviso espera a que el usuario lo cierre y no debe frenar la app.
      std::thread::spawn(move || show_message_box(&texts.notice_title, &texts.notice_body));
    }
  }
}

/// Muestra, restaura y enfoca la ventana principal (desde la bandeja o al abrir la app otra vez).
pub fn show_main_window(app: &AppHandle) {
  if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
  }
}

/// true solo la primera vez: deja la marca para que el aviso no se repita, ni tras reiniciar la app.
fn claim_first_notice(marker: &Path) -> bool {
  if marker.exists() {
    return false;
  }
  if let Some(dir) = marker.parent() {
    let _ = std::fs::create_dir_all(dir);
  }
  if let Err(e) = std::fs::write(marker, b"") {
    log::warn!("no se pudo guardar la marca del aviso de la bandeja: {e}");
  }
  true
}

#[cfg(windows)]
fn show_message_box(title: &str, body: &str) {
  #[link(name = "user32")]
  extern "system" {
    fn MessageBoxW(hwnd: isize, text: *const u16, caption: *const u16, kind: u32) -> i32;
  }
  const MB_ICONINFORMATION: u32 = 0x40;
  const MB_SETFOREGROUND: u32 = 0x1_0000;
  const MB_TOPMOST: u32 = 0x4_0000;
  let wide = |text: &str| text.encode_utf16().chain(std::iter::once(0)).collect::<Vec<u16>>();
  let (body, title) = (wide(body), wide(title));
  unsafe {
    MessageBoxW(0, body.as_ptr(), title.as_ptr(), MB_ICONINFORMATION | MB_SETFOREGROUND | MB_TOPMOST);
  }
}

#[cfg(not(windows))]
fn show_message_box(title: &str, body: &str) {
  log::info!("{title}: {body}");
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn the_first_close_notice_is_claimed_only_once_even_after_a_restart() {
    let dir = std::env::temp_dir().join(format!("redsana-tray-test-{}", std::process::id()));
    let marker = dir.join(NOTICE_SHOWN_FILE);
    let _ = std::fs::remove_dir_all(&dir);

    assert!(claim_first_notice(&marker));
    assert!(!claim_first_notice(&marker));
    assert!(marker.exists(), "la marca sobrevive a cerrar la app");

    let _ = std::fs::remove_dir_all(&dir);
  }

  #[test]
  fn the_texts_arrive_in_camel_case_from_the_frontend() {
    let texts: TrayTexts = serde_json::from_value(serde_json::json!({
      "open": "Abrir", "quit": "Salir", "tooltip": "t", "noticeTitle": "n", "noticeBody": "b"
    }))
    .expect("deserializa");
    assert_eq!((texts.open.as_str(), texts.notice_body.as_str()), ("Abrir", "b"));
  }
}

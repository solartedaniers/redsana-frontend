mod autostart;
mod console_command;
mod lan_scan;
mod pending_measurements;
mod ping;
mod router_ports;
mod tray;
mod wifi;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    // Primero: abrir la app otra vez muestra la ventana que ya está en la bandeja, sin otra copia que mida doble.
    .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| tray::show_main_window(app)))
    // Apagado por defecto: no escribe nada en Windows hasta que el interruptor del perfil llame a set_autostart.
    .plugin(tauri_plugin_autostart::init(
      tauri_plugin_autostart::MacosLauncher::LaunchAgent,
      Some(vec![autostart::AUTOSTART_ARG]),
    ))
    .manage(tray::TrayState::default())
    .on_window_event(|window, event| {
      if let tauri::WindowEvent::CloseRequested { api, .. } = event {
        tray::on_close_requested(window, api);
      }
    })
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      autostart::show_window_unless_autostart(app.handle());
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      ping::measure_latency,
      ping::measure_network_quality,
      pending_measurements::load_pending_measurements,
      pending_measurements::save_pending_measurements,
      wifi::get_wifi_encryption,
      lan_scan::scan_connected_devices,
      lan_scan::scan_present_devices,
      lan_scan::current_gateway_mac,
      router_ports::scan_router_open_ports,
      tray::install_tray,
      autostart::is_autostart_launch,
      autostart::autostart_enabled,
      autostart::set_autostart
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

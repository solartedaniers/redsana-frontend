mod console_command;
mod lan_scan;
mod ping;
mod router_ports;
mod wifi;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      ping::measure_latency,
      ping::measure_network_quality,
      wifi::get_wifi_encryption,
      lan_scan::scan_connected_devices,
      router_ports::scan_router_open_ports
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

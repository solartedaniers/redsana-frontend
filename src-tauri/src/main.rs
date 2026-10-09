// Evita la ventana de consola extra en Windows en release. ¡NO LO QUITES!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  app_lib::run();
}

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let builder = tauri::Builder::default();
  // Muss als erstes Plugin kommen: ein zweiter Start (z. B. über goblinio://) holt nur das offene Fenster nach vorn
  #[cfg(desktop)]
  let builder = builder.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
    if let Some(w) = app.get_webview_window("main") {
      let _ = w.unminimize();
      let _ = w.show();
      let _ = w.set_focus();
    }
  }));
  let builder = builder.plugin(tauri_plugin_opener::init()).plugin(tauri_plugin_deep_link::init());
  #[cfg(desktop)]
  let builder = builder
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_process::init());
  builder
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

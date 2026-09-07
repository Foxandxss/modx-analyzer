mod audio;
mod connection;
mod keyboard;

use audio::Audio;
use connection::Connection;
use keyboard::Keyboard;
use tauri::{LogicalSize, Manager};

/// The measured useful client area on the target laptop: a 14" panel of
/// 1920×1200 physical pixels at 150 % Windows scaling gives 1280×800 CSS px, of
/// which the native window frame takes 60. It is a measurement, not a taste:
/// below it the diagram and the Part screens stop fitting.
const MIN_CLIENT_WIDTH: f64 = 1280.0;
const MIN_CLIENT_HEIGHT: f64 = 740.0;

/// Version and the folder where the volcados de seguridad are written.
///
/// The path travels to the front because a safety file the owner cannot locate
/// does not count as safety.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct AppInfo {
    version: String,
    dumps_folder: String,
}

#[tauri::command]
fn app_info(app: tauri::AppHandle) -> Result<AppInfo, String> {
    let dumps_folder = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("dumps");

    Ok(AppInfo {
        version: app.package_info().version.to_string(),
        dumps_folder: dumps_folder.to_string_lossy().into_owned(),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Connection::new())
        .manage(Keyboard::new())
        .manage(Audio::new())
        .invoke_handler(tauri::generate_handler![
            app_info,
            keyboard::panic_keyboard,
            audio::subscribe_audio_blocks
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let window = app
                .get_webview_window("main")
                .expect("the main window is declared in tauri.conf.json");
            window.set_min_size(Some(LogicalSize::new(MIN_CLIENT_WIDTH, MIN_CLIENT_HEIGHT)))?;

            // Startup order: the port first, so the pánico is live before anything
            // else can make a note sound, and the audio device last. The volcado de
            // seguridad, the ancla, the relectura and the rings slot in between as
            // their own tickets land.
            keyboard::start(app.handle());
            audio::start(app.handle());

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

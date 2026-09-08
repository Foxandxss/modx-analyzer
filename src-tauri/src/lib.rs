mod anchor;
mod audio;
mod connection;
mod dumps;
mod generator;
mod keyboard;
mod patch;
mod polling;
mod sweep;

use audio::Audio;
use connection::Connection;
use dumps::Dumps;
use generator::Generator;
use keyboard::Keyboard;
use patch::Patch;
use sweep::Sweeps;
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
    Ok(AppInfo {
        version: app.package_info().version.to_string(),
        dumps_folder: dumps::folder(&app)?.to_string_lossy().into_owned(),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Connection::new())
        .manage(Keyboard::new())
        .manage(Audio::new())
        .manage(Dumps::new())
        .manage(Patch::new())
        .manage(polling::Polling::new())
        .manage(Generator::new())
        .manage(Sweeps::new())
        .invoke_handler(tauri::generate_handler![
            app_info,
            connection::connection_state,
            dumps::last_dump,
            keyboard::panic_keyboard,
            keyboard::retry_connection,
            polling::set_polling,
            polling::polling_state,
            audio::export_window,
            audio::subscribe_audio_blocks,
            audio::measure_window,
            generator::start_generator,
            generator::stop_generator,
            generator::generator_state,
            sweep::sweep_operator
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
            // else can make a note sound; then the volcado de seguridad, which is
            // the first thing that touches the keyboard; then the ancla, which
            // reads the name and takes the relectura of the whole patch with it;
            // then the anillo ancho; then the audio device last.
            //
            // Each of these runs on a thread of its own — this function has to
            // return for the window to appear, and the volcado holds the port for
            // seconds while the rings never let go of it at all — so the order
            // here is the order they *ask* in, not the order they finish in. That
            // the order **holds** is the port owner's doing and not this line's:
            // `Dump` is served ahead of `Anchor` and `Anchor` ahead of
            // `WideRing` (ADR-0004), so the volcado goes out whole, the relectura
            // runs at full speed behind it, and the ring's first pass waits for
            // both rather than interleaving with them.
            keyboard::start(app.handle());
            dumps::start(app.handle());
            anchor::start(app.handle());
            patch::start(app.handle());
            audio::start(app.handle());

            Ok(())
        })
        // The one interruption the generator's `Drop` cannot survive is the
        // process going away, so the window's close asks it to stop and waits for
        // the Note Offs. Closing the app with four keys down would leave them
        // sounding with nothing left running to silence them.
        .on_window_event(|window, event| {
            if matches!(event, tauri::WindowEvent::CloseRequested { .. }) {
                Generator::stop(window.app_handle());
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

//! El volcado de seguridad, taken at every startup and never deleted.
//!
//! One file per launch, under the app data directory, named with the timestamp and
//! the Part 1 name. The rule the whole thing exists for is short: **whatever the
//! app does afterwards, the patch that was in the edit buffer when it started can
//! be put back**, byte for byte, from a file the owner can find.
//!
//! This session writes no parameters, so a volcado that fails is a warning with
//! the folder path and the app carries on. When the first write arrives that stops
//! being true: a missing volcado becomes a block, because then there is something
//! to undo. That sentence belongs in `docs/results` and is repeated here because
//! this is the file somebody will read when they add the first write.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use modx_midi::dump::{self, Dump};
use tauri::{AppHandle, Emitter, Manager};

use crate::keyboard::Keyboard;

/// The event the aviso strip and the VOLCADOS cell listen to.
const EVENT_DUMP: &str = "modx://dump";

/// Raw SysEx, the extension every MIDI tool already knows. The bytes in it are
/// exactly what came off the wire, in order, so restoring is sending the file.
const EXTENSION: &str = "syx";

/// What a Part with no readable name is filed under, so a nameless volcado still
/// gets a file instead of being dropped.
const UNNAMED: &str = "sin nombre";

/// How the volcado of this launch went.
#[derive(Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum DumpState {
    /// The documented 123 messages and 7 669 bytes, or more.
    Saved,
    /// Fewer bytes than the one dump that was ever measured. Written anyway:
    /// throwing the bytes away would turn a bad volcado into no volcado.
    Short,
    /// Nothing came back, or the port was not open, or the file would not write.
    Failed,
}

/// What the front draws about the volcado.
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DumpView {
    pub state: DumpState,
    /// Full path of the file, or nothing when there is no file.
    pub path: Option<String>,
    /// Full path of the folder. Present in every state, including the failures:
    /// a warning that does not say where to look is not a warning.
    pub folder: String,
    pub bytes: usize,
    pub messages: usize,
    /// From the Bulk Dump Request to the end of the stream. `None` when the dump
    /// never ran, so the front draws the dash and not a zero.
    pub took_ms: Option<u64>,
    /// One line saying what went wrong, or nothing when nothing did.
    pub reason: Option<String>,
    /// What the 123 messages and 7 669 bytes of fase 0c were, so the front can
    /// say `123 DE 123` without hardcoding the pair.
    pub expected_messages: usize,
    pub expected_bytes: usize,
}

impl DumpView {
    fn failed(folder: &Path, reason: impl Into<String>) -> Self {
        Self {
            state: DumpState::Failed,
            path: None,
            folder: folder.to_string_lossy().into_owned(),
            bytes: 0,
            messages: 0,
            took_ms: None,
            reason: Some(reason.into()),
            expected_messages: dump::DOCUMENTED_MESSAGES,
            expected_bytes: dump::DOCUMENTED_BYTES,
        }
    }
}

/// The volcado of this launch, kept so a screen that opens late can still ask.
#[derive(Default)]
pub struct Dumps {
    view: Mutex<Option<DumpView>>,
}

impl Dumps {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn view(&self) -> Option<DumpView> {
        self.view
            .lock()
            .expect("the dumps lock is not held across a panic")
            .clone()
    }
}

/// The folder the volcados live in. It is the same path `app_info` reports, and
/// the same one the aviso prints when the dump fails.
pub fn folder(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("dumps"))
}

/// Take the volcado and file it. Runs on its own thread: it holds the MIDI port
/// for as long as the keyboard takes to send 7,7 KB, and the window has to be on
/// screen while that happens.
pub fn start(app: &AppHandle) {
    let app = app.clone();
    std::thread::Builder::new()
        .name("modx-volcado".into())
        .spawn(move || {
            let view = take_and_file(&app);
            match view.state {
                DumpState::Saved => log::info!(
                    "volcado de seguridad: {} bytes en {}",
                    view.bytes,
                    view.path.as_deref().unwrap_or("?")
                ),
                _ => log::warn!(
                    "volcado de seguridad: {}",
                    view.reason.as_deref().unwrap_or("sin motivo")
                ),
            }
            publish(&app, view);
        })
        .expect("the volcado thread is spawned once at startup");
}

fn publish(app: &AppHandle, view: DumpView) {
    *app.state::<Dumps>()
        .view
        .lock()
        .expect("the dumps lock is not held across a panic") = Some(view.clone());
    let _ = app.emit(EVENT_DUMP, view);
}

fn take_and_file(app: &AppHandle) -> DumpView {
    let folder = match folder(app) {
        Ok(folder) => folder,
        Err(error) => return DumpView::failed(Path::new(""), error),
    };

    let keyboard = app.state::<Keyboard>();
    let taken = match keyboard.dump(dump::EDIT_BUFFER) {
        Ok(taken) => taken,
        Err(error) => {
            return DumpView::failed(&folder, format!("could not request the dump: {error}"))
        }
    };

    if taken.is_empty() {
        return DumpView::failed(
            &folder,
            "the keyboard did not answer the 0E 25 00 dump".to_owned(),
        );
    }

    // The name is read after the bytes, not before: the volcado is the thing that
    // matters and a keyboard that stops answering between the two still gets its
    // file, under `sin nombre`.
    let name = keyboard.part_name(1).unwrap_or_default();

    match write(&folder, &name, &taken) {
        Ok(path) => DumpView {
            state: if taken.is_short() {
                DumpState::Short
            } else {
                DumpState::Saved
            },
            path: Some(path.to_string_lossy().into_owned()),
            folder: folder.to_string_lossy().into_owned(),
            bytes: taken.bytes.len(),
            messages: taken.messages,
            took_ms: Some(taken.took.as_millis() as u64),
            reason: taken.is_short().then(|| {
                format!(
                    "short dump: {} of {} bytes. Check Bulk Interval in [UTILITY] → MIDI I/O",
                    taken.bytes.len(),
                    dump::DOCUMENTED_BYTES
                )
            }),
            expected_messages: dump::DOCUMENTED_MESSAGES,
            expected_bytes: dump::DOCUMENTED_BYTES,
        },
        Err(error) => DumpView::failed(&folder, format!("could not write the dump: {error}")),
    }
}

/// Write the bytes under a name nothing else will take. Never overwrites and never
/// deletes: a volcado that replaced yesterday's is not a safety copy.
fn write(folder: &Path, name: &str, taken: &Dump) -> std::io::Result<PathBuf> {
    fs::create_dir_all(folder)?;

    let stamp = chrono::Local::now().format("%Y-%m-%d_%H%M%S");
    let mut path = folder.join(format!("{stamp} {}.{EXTENSION}", file_name(name)));
    // Two launches inside the same second is not a reason to lose one of them.
    let mut attempt = 1;
    while path.exists() {
        attempt += 1;
        path = folder.join(format!(
            "{stamp} {} ({attempt}).{EXTENSION}",
            file_name(name)
        ));
    }

    fs::write(&path, &taken.bytes)?;
    Ok(path)
}

/// The Part name, made safe to be part of a file name.
///
/// MODX names carry parentheses, plus signs and spaces — `Init Normal (FM-X)` has
/// all three — and none of those are a problem on Windows. What is reserved is
/// `<>:"/\|?*`, control characters and a trailing dot or space.
fn file_name(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|letter| {
            if letter.is_control() || r#"<>:"/\|?*"#.contains(letter) {
                '_'
            } else {
                letter
            }
        })
        .collect();

    let trimmed = cleaned.trim_matches([' ', '.']);
    if trimmed.is_empty() {
        UNNAMED.to_owned()
    } else {
        trimmed.to_owned()
    }
}

/// The volcado of this launch, for a screen that opened after it was taken.
#[tauri::command]
pub fn last_dump(app: AppHandle) -> Option<DumpView> {
    app.state::<Dumps>().view()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_the_parentheses_of_the_init_performance() {
        assert_eq!(file_name("Init Normal (FM-X)"), "Init Normal (FM-X)");
        assert_eq!(file_name("CFX + FM EP"), "CFX + FM EP");
    }

    #[test]
    fn replaces_what_windows_will_not_take_and_never_gives_up_the_file() {
        assert_eq!(file_name("A/B: \"x\"?"), "A_B_ _x__");
        assert_eq!(file_name("   "), UNNAMED);
        assert_eq!(file_name(""), UNNAMED);
        // A name ending in a dot is legal on the MODX and is not on Windows.
        assert_eq!(file_name("Bell."), "Bell");
    }
}

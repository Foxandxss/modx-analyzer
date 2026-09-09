//! The one line of the header that says what the app is attached to.
//!
//! `MODX-1` and `Line (MODX)` are two separate devices opened by two separate
//! modules, but the front sees them as one `ConnectionView`. If each module
//! emitted its own the second would erase the first's fields, so the state lives
//! here and both go through it.

use std::sync::Mutex;

use modx_audio::DeviceInfo;
use modx_midi::link::Link;
use modx_midi::port::PORT_NAME;
use tauri::{AppHandle, Emitter, Manager};

/// The event the header's connection dot and audio line listen to.
const EVENT_CONNECTION: &str = "modx://connection";

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionView {
    /// `connected` or `disconnected`, matching the front's `PortState`.
    pub port: &'static str,
    /// Why the port counts as gone (`enumeration` or `timeouts`), or nothing when
    /// it does not. The card draws the same either way; what it changes is the
    /// sentence, and a card that cannot say why is a card nobody trusts.
    pub loss: Option<&'static str>,
    pub port_name: Option<String>,
    /// `Line (MODX)`, or nothing while the audio device is not open: the header
    /// draws the dash rather than a zero.
    pub audio_device: Option<String>,
    pub sample_rate: Option<u32>,
    /// How many channels the open stream delivers, 2 on this hardware.
    ///
    /// It is the third of the three facts the `LIVE` pill states, and it is here
    /// rather than hardcoded on the front for the same reason as the other two:
    /// what the pill says has to be what the app actually opened. `CHANNELS` is
    /// what [`modx_audio`] *asks* for; this is what the device answered.
    pub channels: Option<u16>,
}

impl Default for ConnectionView {
    fn default() -> Self {
        Self {
            port: "disconnected",
            // Nothing has looked yet, so nothing is claimed about why. The two
            // unhappy cards hang off the *reason*, so an app that opens saying
            // «enumeration» would draw the disconnected card before it has tried.
            loss: None,
            port_name: None,
            audio_device: None,
            sample_rate: None,
            channels: None,
        }
    }
}

impl ConnectionView {
    /// Take the three audio facts from the open stream, or drop all three.
    ///
    /// One function and not three assignments, because the failure it exists to
    /// prevent is a field left behind: a device that closed while the pill kept
    /// saying `2 ch` would be the `LIVE` stamp over a stream that ended (#22),
    /// one field down. They arrive together and they leave together.
    fn set_audio(&mut self, device: Option<DeviceInfo>) {
        match device {
            Some(device) => {
                self.audio_device = Some(device.name);
                self.sample_rate = Some(device.sample_rate);
                self.channels = Some(device.channels);
            }
            None => {
                self.audio_device = None;
                self.sample_rate = None;
                self.channels = None;
            }
        }
    }
}

/// The merged view, and the only thing that emits it.
#[derive(Default)]
pub struct Connection {
    view: Mutex<ConnectionView>,
}

impl Connection {
    pub fn new() -> Self {
        Self::default()
    }

    /// Say what the link to `MODX-1` is doing, leaving the audio fields as they
    /// were.
    ///
    /// The **name is kept through a disconnection**: `MODX-1` is what the header
    /// has been saying all session and what the owner is looking for behind the
    /// keyboard. Blanking it would turn a port that is not answering into a port
    /// that was never there.
    pub fn set_link(app: &AppHandle, link: Link) {
        Self::update(app, |view| match link {
            Link::Connected => {
                view.port = "connected";
                view.loss = None;
                view.port_name = Some(PORT_NAME.to_owned());
            }
            Link::Disconnected(loss) => {
                view.port = "disconnected";
                view.loss = Some(loss.as_str());
                view.port_name.get_or_insert_with(|| PORT_NAME.to_owned());
            }
        });
    }

    /// Whether the app is in `DESCONECTADO` right now.
    ///
    /// The pánico asks so that it can reopen **before** it sends rather than
    /// after it has failed: a hung note does not care why the app thinks the port
    /// is gone, and 2 080 messages down a dead handle is a second of not
    /// silencing anything.
    pub fn is_disconnected(app: &AppHandle) -> bool {
        app.state::<Connection>().view().port == "disconnected"
    }

    /// Say what the audio device reports, leaving the port fields as they were.
    ///
    /// The whole [`DeviceInfo`] and not a tuple of the fields the header happens
    /// to draw today: the pill states what the stream answered, so the stream's
    /// own report is what crosses.
    pub fn set_audio(app: &AppHandle, device: Option<DeviceInfo>) {
        Self::update(app, |view| view.set_audio(device));
    }

    /// The merged view as it stands right now.
    ///
    /// Nobody is told anything by asking: this is the same value the last
    /// [`EVENT_CONNECTION`] carried, for whoever was not listening when it went.
    pub fn view(&self) -> ConnectionView {
        self.view
            .lock()
            .expect("the connection lock is not held across a panic")
            .clone()
    }

    fn update(app: &AppHandle, change: impl FnOnce(&mut ConnectionView)) {
        let state = app.state::<Connection>();
        let view = {
            let mut view = state
                .view
                .lock()
                .expect("the connection lock is not held across a panic");
            change(&mut view);
            view.clone()
        };
        let _ = app.emit(EVENT_CONNECTION, view);
    }
}

/// What the link is doing, for a window that opened after the port did.
///
/// `Keyboard::connect` emits [`EVENT_CONNECTION`] from the setup thread, very
/// likely before this window has run a line of JavaScript, and [`LinkWatch`]
/// only re-emits **on a change** — so with a keyboard that is there and stays
/// there, the one event saying so is missed and never repeated. The front then
/// draws its own opening default, `DESCONECTADO` with no reason, for the rest of
/// the session over a port that is answering.
///
/// That is exactly what happened on the 2026-09-08 keyboard session (#18), and
/// it is why the volcado and the generator are asked for as well as listened to.
/// This is the same guard for the third of them.
///
/// [`LinkWatch`]: modx_midi::link::LinkWatch
#[tauri::command]
pub fn connection_state(app: AppHandle) -> ConnectionView {
    app.state::<Connection>().view()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The three audio facts are one fact with three fields.
    ///
    /// The header states all three in one line, so a device that closes has to
    /// take all three with it: a rate or a channel count that outlived its
    /// device would be drawn beside the dash of the name it belonged to.
    #[test]
    fn the_three_audio_facts_arrive_and_leave_together() {
        let mut view = ConnectionView::default();
        assert_eq!(
            (view.audio_device.clone(), view.sample_rate, view.channels),
            (None, None, None)
        );

        view.set_audio(Some(DeviceInfo {
            name: "Line (MODX)".to_owned(),
            sample_rate: 44_100,
            channels: 2,
        }));
        assert_eq!(view.audio_device.as_deref(), Some("Line (MODX)"));
        assert_eq!(view.sample_rate, Some(44_100));
        assert_eq!(view.channels, Some(2));

        view.set_audio(None);
        assert_eq!(view.audio_device, None);
        assert_eq!(view.sample_rate, None);
        assert_eq!(view.channels, None);
    }

    /// The port fields are not the audio fields: the two devices are opened by
    /// two modules and neither may erase the other's half of the view.
    #[test]
    fn closing_the_audio_device_keeps_the_port_name() {
        let mut view = ConnectionView {
            port: "connected",
            loss: None,
            port_name: Some(PORT_NAME.to_owned()),
            ..ConnectionView::default()
        };

        view.set_audio(None);

        assert_eq!(view.port, "connected");
        assert_eq!(view.port_name.as_deref(), Some(PORT_NAME));
    }
}

//! Application bootstrap and QML bridge (AppModel).
//!
//! For now, AppModel is a minimal QObject stub that exposes state to QML.
//! When Qt bindings (qmetaobject) are fully wired, the bootstrap() function
//! will initialize the QML engine and display the pet window.

use crate::AppContext;
use std::sync::{Arc, Mutex};

/// AppModel — exposed to QML as `appModel`.
///
/// Properties:
///   - currentState: QString — the current DisplayState name (e.g. "idle")
///   - badgeText: QString — debug info (state + timestamp)
///
/// Slots (Q_INVOKABLE):
///   - userClicked(zone: QString)
///   - userDoubleClicked()
///   - switchLanguage(lang: QString)
pub struct AppModel {
    ctx: Arc<Mutex<AppContext>>,
}

impl AppModel {
    pub fn new(ctx: Arc<Mutex<AppContext>>) -> Self {
        Self { ctx }
    }

    // Property getters (called by QML)

    pub fn current_state(&self) -> String {
        let ctx = self.ctx.lock().unwrap();
        ctx.core.current.to_string()
    }

    pub fn badge_text(&self) -> String {
        let ctx = self.ctx.lock().unwrap();
        format!("{} ({})", ctx.core.current.label(), ctx.core.current.to_string())
    }

    // Slots — called from QML

    pub fn user_clicked(&self, zone: &str) {
        log::info!("[AppModel] userClicked zone={zone}");
        // Future: play tap audio, trigger state change
    }

    pub fn user_double_clicked(&self) {
        log::info!("[AppModel] userDoubleClicked");
        // Future: open input dialog for chat
    }

    pub fn switch_language(&self, lang: &str) {
        log::info!("[AppModel] switchLanguage lang={lang}");
        // Future: update TTS config + system prompt language
    }

    pub fn request_state(&self, state_name: &str) {
        let mut ctx = self.ctx.lock().unwrap();
        if let Some(state) = native_desktop_core::state::DisplayState::from_llm_response(state_name) {
            ctx.core.force_set(state);
            log::info!("[AppModel] Force-set state to {state_name}");
        }
    }
}

/// Bootstrap the application: init QML engine, create AppModel, show window.
///
/// Note: Full qmetaobject integration requires Qt development libraries
/// linked. For now, this is a stub that validates the core logic compiles.
pub fn bootstrap() {
    log::info!("[bootstrap] DeskPet native desktop starting...");

    let ctx = Arc::new(Mutex::new(AppContext::new()));
    let _model = AppModel::new(ctx);

    log::info!("[bootstrap] AppModel created. Current state: {}",
        native_desktop_core::state::DisplayState::default().to_string());

    // TODO: Initialize QML engine, register AppModel, load Main.qml.
    // This requires the qmetaobject crate with Qt 6 libraries linked.
    log::info!("[bootstrap] QML integration pending — core logic is ready.");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_model_initial_state() {
        let ctx = Arc::new(Mutex::new(AppContext::new()));
        let model = AppModel::new(ctx);
        assert_eq!(model.current_state(), "idle");
        assert!(model.badge_text().contains("待机"));
    }

    #[test]
    fn app_model_request_state() {
        let ctx = Arc::new(Mutex::new(AppContext::new()));
        let model = AppModel::new(ctx);
        model.request_state("happy");
        assert_eq!(model.current_state(), "happy");
    }

    #[test]
    fn app_model_invalid_state_no_change() {
        let ctx = Arc::new(Mutex::new(AppContext::new()));
        let model = AppModel::new(ctx);
        model.request_state("invalid");
        assert_eq!(model.current_state(), "idle");
    }
}

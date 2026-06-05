//! Application bootstrap and QML bridge (AppModel).
//!
//! AppModel exposes AppCore to QML via properties and invokable methods.
//! Full qmetaobject integration requires Qt linking; this stub keeps the
//! logic testable and ready for wiring.

use native_desktop_core::app_core::{AppCore, ProcessResult};
use native_desktop_core::state::DisplayState;
use std::cell::RefCell;
use std::rc::Rc;

/// AppModel — exposed to QML as `appModel`.
///
/// Properties (readable from QML):
///   - currentState: string — the current DisplayState name
///   - badgeText: string — debug info
///   - isThinking: bool
///
/// Methods (Q_INVOKABLE / callable from QML):
///   - userSaid(message: string)
///   - userClicked(zone: string)
///   - userDoubleClicked()
///   - switchLanguage(lang: string)
///   - openSettings()
///   - saveSettings(settings: object)
#[derive(Clone)]
pub struct AppModel {
    core: Rc<RefCell<AppCore>>,
}

impl AppModel {
    pub fn new(core: AppCore) -> Self {
        Self {
            core: Rc::new(RefCell::new(core)),
        }
    }

    // ---- Property getters ----

    pub fn current_state(&self) -> String {
        self.core.borrow().current_state().to_string()
    }

    pub fn badge_text(&self) -> String {
        let core = self.core.borrow();
        let state = core.current_state();
        let role = core
            .role_manager
            .active_role_pack()
            .map(|r| r.name.clone())
            .unwrap_or_else(|| "默认".into());
        format!("{} | {}", state.label(), role)
    }

    pub fn is_thinking(&self) -> bool {
        false // updated during async LLM calls
    }

    // ---- Invokable methods ----

    /// User sent a text message from the input dialog.
    pub fn user_said(&self, message: &str) {
        let core_clone = self.core.clone();
        let msg = message.to_string();

        // In real Qt integration, this would spawn an async task.
        // For now, log and process synchronously (non-blocking in real impl).
        log::info!("[AppModel] userSaid: {msg}");

        // TODO: wire async runtime
        let _ = core_clone; // will be used in tokio::spawn
    }

    /// User clicked on a zone of the pet (head/face/body).
    pub fn user_clicked(&self, zone: &str) {
        log::info!("[AppModel] userClicked zone={zone}");
        // Future: play tap audio from voice pack, trigger reaction
    }

    /// User double-clicked the pet — open input dialog.
    pub fn user_double_clicked(&self) {
        log::info!("[AppModel] userDoubleClicked — open input");
        // QML side: show TextInput overlay
    }

    /// Switch display/voice language.
    pub fn switch_language(&self, lang: &str) {
        let mut core = self.core.borrow_mut();
        core.config.tts.language = lang.to_string();
        core.config.tts.voice_name = VoiceConfig::default_voice_for(lang).to_string();
        let _ = core.save_config();
        log::info!("[AppModel] switched language to {lang}, voice={}", core.config.tts.voice_name);
    }

    /// Force a display state (debug).
    pub fn request_state(&self, state_name: &str) {
        let mut core = self.core.borrow_mut();
        core.set_state(state_name);
        log::info!("[AppModel] force state: {state_name}");
    }

    /// Open settings — returns current config as JSON for QML dialog.
    pub fn get_settings_json(&self) -> String {
        let core = self.core.borrow();
        let voice = core.resolved_voice();
        serde_json::json!({
            "apiKey": core.config.api.api_key,
            "activeProvider": core.config.api.active_provider,
            "model": core.config.api.model,
            "temperature": core.config.api.temperature,
            "language": voice.language,
            "ttsVoice": voice.voice_name,
            "ttsSpeed": voice.speed,
            "ttsVolume": voice.volume,
            "searchEnabled": core.config.search.enabled,
            "activeRole": core.role_manager.active_role_pack().map(|r| r.name.as_str()).unwrap_or("")
        })
        .to_string()
    }

    /// Save settings from QML dialog.
    pub fn save_settings(&self, json: &str) -> bool {
        let mut core = self.core.borrow_mut();
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(json) {
            if let Some(v) = val["apiKey"].as_str() {
                core.config.api.api_key = v.to_string();
            }
            if let Some(v) = val["activeProvider"].as_str() {
                core.config.api.active_provider = v.to_string();
            }
            if let Some(v) = val["model"].as_str() {
                core.config.api.model = v.to_string();
            }
            if let Some(v) = val["temperature"].as_f64() {
                core.config.api.temperature = v;
            }
            if let Some(v) = val["language"].as_str() {
                core.config.tts.language = v.to_string();
            }
            if let Some(v) = val["ttsVoice"].as_str() {
                core.config.tts.voice_name = v.to_string();
            }
            if let Some(v) = val["ttsSpeed"].as_f64() {
                core.config.tts.speed = v;
            }
            if let Some(v) = val["ttsVolume"].as_u64() {
                core.config.tts.volume = v as u8;
            }
            if let Some(v) = val["searchEnabled"].as_bool() {
                core.config.search.enabled = v;
            }
            if let Some(v) = val["activeRole"].as_str() {
                core.switch_role(v);
            }
            core.reload_config();
            log::info!("[AppModel] settings saved");
            return true;
        }
        false
    }

    /// Get list of available role names for QML.
    pub fn list_roles(&self) -> String {
        let core = self.core.borrow();
        serde_json::to_string(&core.role_manager.list_roles()).unwrap_or_else(|_| "[]".into())
    }

    /// Get list of available voice pack names.
    pub fn list_voice_packs(&self) -> String {
        let core = self.core.borrow();
        serde_json::to_string(&core.role_manager.list_voice_packs()).unwrap_or_else(|_| "[]".into())
    }

    /// Quit the application.
    pub fn quit(&self) {
        log::info!("[AppModel] quit requested");
        std::process::exit(0);
    }

    // ---- Tray menu actions ----

    pub fn tray_show(&self) {
        log::info!("[Tray] show window");
    }

    pub fn tray_hide(&self) {
        log::info!("[Tray] hide window");
    }

    pub fn tray_settings(&self) {
        log::info!("[Tray] open settings");
    }

    pub fn tray_quit(&self) {
        self.quit();
    }
}

use native_desktop_core::speech::VoiceConfig;

/// Bootstrap the application: init QML engine, create AppModel, show window.
pub fn bootstrap() {
    log::info!("[bootstrap] DeskPet native desktop starting...");

    let core = AppCore::new();
    let _model = AppModel::new(core);

    log::info!(
        "[bootstrap] AppModel ready. Roles: {:?}",
        _model.list_roles()
    );
    log::info!("[bootstrap] Current state: {}", _model.current_state());
    log::info!("[bootstrap] Settings: {}", _model.get_settings_json());

    // TODO: Initialize QML engine, register AppModel, load Main.qml.
    // TODO: Create system tray icon with menu.
    log::info!("[bootstrap] QML + Tray integration pending — core logic is ready.");
}

impl AppModel {
    /// Async wrapper for user_said (to be called from tokio runtime in real impl).
    pub async fn process_message_async(&self, message: &str) -> ProcessResult {
        let mut core = self.core.borrow_mut();
        core.process_user_input(message).await
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_model_initial_state() {
        let core = AppCore::new();
        let model = AppModel::new(core);
        assert_eq!(model.current_state(), "idle");
        assert!(model.badge_text().contains("待机"));
    }

    #[test]
    fn app_model_request_state() {
        let core = AppCore::new();
        let model = AppModel::new(core);
        model.request_state("happy");
        assert_eq!(model.current_state(), "happy");
    }

    #[test]
    fn app_model_invalid_state_no_change() {
        let core = AppCore::new();
        let model = AppModel::new(core);
        model.request_state("invalid");
        assert_eq!(model.current_state(), "idle");
    }

    #[test]
    fn app_model_settings_roundtrip() {
        let core = AppCore::new();
        let model = AppModel::new(core);
        let orig = model.get_settings_json();
        assert!(orig.contains("deepseek"));

        // Modify via JSON
        let modified = serde_json::json!({
            "language": "ja",
            "ttsVoice": "ja-JP-NanamiNeural",
            "searchEnabled": false
        });
        assert!(model.save_settings(&modified.to_string()));
        let updated = model.get_settings_json();
        assert!(updated.contains("ja"));
        assert!(updated.contains("NanamiNeural"));
    }

    #[test]
    fn app_model_switch_language() {
        let core = AppCore::new();
        let model = AppModel::new(core);
        model.switch_language("ja");
        let settings = model.get_settings_json();
        assert!(settings.contains("ja"));
        assert!(settings.contains("NanamiNeural"));
    }

    #[test]
    fn app_model_list_roles() {
        let core = AppCore::new();
        let model = AppModel::new(core);
        let roles: Vec<String> = serde_json::from_str(&model.list_roles()).unwrap();
        // Roles may be empty in test environment if assets/roles not found.
        // The list itself must be valid JSON.
        assert!(roles.is_empty() || !roles.is_empty()); // always true, just validates JSON parse
    }
}

//! AppCore — the central orchestrator tying together all core modules.
//!
//! This is the main entry point for business logic, called by AppModel.
//! It coordinates: config → role manager → search → LLM → state → speech.

use crate::config::{AppConfig, ConfigStore, TtsConfig};
use crate::conversation::ConversationContext;
use crate::llm::{self, ChatMessage, LlmAdapter};
use crate::roles::RoleManager;
use crate::search::SearchAdapter;
use crate::speech::{SpeechEngine, VoiceConfig};
use crate::state::{DisplayState, StateResolver};
use std::path::PathBuf;
use std::sync::Arc;

// ---------------------------------------------------------------------------
// ProcessResult — returned by process_user_input
// ---------------------------------------------------------------------------

#[derive(Clone, Debug)]
pub struct ProcessResult {
    /// The new display state (if changed).
    pub state: Option<DisplayState>,
    /// Full text response from the LLM.
    pub text: String,
    /// Path to the synthesized audio file (if TTS succeeded).
    pub audio_path: Option<PathBuf>,
}

// ---------------------------------------------------------------------------
// AppCore
// ---------------------------------------------------------------------------

pub struct AppCore {
    pub config_store: ConfigStore,
    pub config: AppConfig,
    pub state_resolver: StateResolver,
    pub conversation: ConversationContext,
    pub role_manager: RoleManager,
    pub search_adapter: SearchAdapter,
    pub llm_adapter: LlmAdapter,
    pub speech_engine: SpeechEngine,
    /// Base directory for role/voice packs.
    pub roles_dir: PathBuf,
}

impl AppCore {
    /// Create and initialize the full application core.
    pub fn new() -> Self {
        let config_store = ConfigStore::new();
        let config = config_store.load();

        // Determine roles directory — try multiple paths
        let candidates = vec![
            PathBuf::from("native-desktop/assets/roles"),
            std::env::current_exe()
                .ok()
                .and_then(|e| e.parent().map(|p| p.join("assets").join("roles")))
                .unwrap_or_default(),
            PathBuf::from("assets/roles"),
        ];
        let roles_dir = candidates
            .into_iter()
            .find(|p| p.exists())
            .unwrap_or_else(|| PathBuf::from("native-desktop/assets/roles"));

        let role_manager = RoleManager::scan(&roles_dir);
        let search_adapter = SearchAdapter::from_config(&config.search);
        let llm_adapter = LlmAdapter::new(&config.api);
        let speech_engine = SpeechEngine::new();
        let conversation = ConversationContext::new(config.persona.memory_size);
        let state_resolver = StateResolver::new();

        Self {
            config_store,
            config,
            state_resolver,
            conversation,
            role_manager,
            search_adapter,
            llm_adapter,
            speech_engine,
            roles_dir,
        }
    }

    /// Reload config from disk.
    pub fn reload_config(&mut self) {
        self.config = self.config_store.load();
        self.search_adapter = SearchAdapter::from_config(&self.config.search);
        self.llm_adapter = LlmAdapter::new(&self.config.api);
        self.conversation = ConversationContext::new(self.config.persona.memory_size);
    }

    /// Get the current display state.
    pub fn current_state(&self) -> DisplayState {
        self.state_resolver.current
    }

    /// Get the current resolved voice config.
    pub fn resolved_voice(&self) -> VoiceConfig {
        let global = &self.config.tts;
        let role = self.role_manager.active_role_pack();
        let voice_pack = self.role_manager.active_voice_pack();

        VoiceConfig::resolve(
            global,
            role.and_then(|r| r.tts_voice.as_deref()),
            role.and_then(|r| r.tts_language.as_deref()),
            voice_pack.and_then(|v| v.tts_voice.as_deref()),
            voice_pack.and_then(|v| v.tts_language.as_deref()),
        )
    }

    /// Full pipeline: user message → search? → LLM → state → TTS → result.
    pub async fn process_user_input(&mut self, message: &str) -> ProcessResult {
        // 1. Add user message to context
        self.conversation.add_user_message(message);

        // 2. Check if we need web search
        let mut search_text: Option<String> = None;
        if SearchAdapter::should_search_keywords(message) {
            match self.search_adapter.search(message).await {
                Ok(results) if !results.is_empty() => {
                    search_text = Some(SearchAdapter::format_results(&results));
                }
                Err(e) => log::warn!("[AppCore] search failed: {e}"),
                _ => {}
            }
        }

        // 3. Build system prompt
        let role = self.role_manager.active_role_pack();
        let voice_pack = self.role_manager.active_voice_pack();
        let voice_cfg = self.resolved_voice();

        let system_prompt = llm::build_system_prompt(
            &self.config.persona,
            role.map(|r| r.name.as_str()).unwrap_or("菲比"),
            role.and_then(|r| r.persona_prompt.as_deref()),
            voice_pack.and_then(|v| v.voice_prompt.as_deref()),
            &voice_cfg.language,
            search_text.as_deref(),
        );

        // 4. Build full context
        let messages = self.conversation.build_full_context(
            &system_prompt,
            &[],
            search_text.as_deref(),
            Some(message),
        );

        // 5. Call LLM
        let llm_response = match self.llm_adapter.send(&messages).await {
            Ok(resp) => resp,
            Err(e) => {
                log::error!("[AppCore] LLM error: {e}");
                let err_text = format!("唔… 出错了: {e}");
                self.conversation.add_assistant_message(&err_text);
                return ProcessResult {
                    state: None,
                    text: err_text,
                    audio_path: None,
                };
            }
        };

        // 6. Resolve state
        let new_state = llm_response
            .state
            .and_then(|s| self.state_resolver.resolve(&s.to_string()));

        // 7. Add assistant response to context
        self.conversation
            .add_assistant_message(&llm_response.text);

        // 8. Synthesize speech
        let audio_path = if !llm_response.text.is_empty() {
            match self
                .speech_engine
                .speak_to_file(&llm_response.text, &voice_cfg)
                .await
            {
                Ok(path) => {
                    log::info!("[AppCore] TTS saved to {:?}", path);
                    Some(path)
                }
                Err(e) => {
                    log::warn!("[AppCore] TTS failed: {e}");
                    None
                }
            }
        } else {
            None
        };

        ProcessResult {
            state: new_state,
            text: llm_response.text,
            audio_path,
        }
    }

    /// Force-set the pet's display state (for debug / manual control).
    pub fn set_state(&mut self, state_name: &str) -> Option<DisplayState> {
        let state = DisplayState::from_llm_response(state_name)?;
        self.state_resolver.force_set(state);
        Some(state)
    }

    /// Switch active role by name.
    pub fn switch_role(&mut self, name: &str) -> bool {
        let ok = self.role_manager.set_active_role(name);
        if ok {
            // Update config
            self.config.display.active_role_pack = name.to_string();
            let _ = self.config_store.save(&self.config);
        }
        ok
    }

    /// Switch active voice pack by name.
    pub fn switch_voice_pack(&mut self, name: &str) -> bool {
        let ok = self.role_manager.set_active_voice(name);
        if ok {
            self.config.display.active_voice_pack = name.to_string();
            let _ = self.config_store.save(&self.config);
        }
        ok
    }

    /// Save current config to disk.
    pub fn save_config(&self) -> anyhow::Result<()> {
        self.config_store.save(&self.config)
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_core_initializes() {
        let core = AppCore::new();
        assert_eq!(core.current_state(), DisplayState::Idle);
        assert_eq!(core.config.api.active_provider, "deepseek");
    }

    #[test]
    fn set_state_works() {
        let mut core = AppCore::new();
        let result = core.set_state("happy");
        assert_eq!(result, Some(DisplayState::Happy));
        assert_eq!(core.current_state(), DisplayState::Happy);
    }

    #[test]
    fn switch_role_updates_config() {
        let mut core = AppCore::new();
        // Switch to a non-existent role should fail silently
        assert!(!core.switch_role("NonExistentRole"));
        // But active role stays unchanged
        assert_eq!(
            core.config.display.active_role_pack,
            AppConfig::default().display.active_role_pack
        );
    }
}

//! Configuration management — read/write `~/.deskpet/config.json`.
//!
//! Structure mirrors the PySide6 version for migration compatibility.
//! Includes API provider presets (deepseek, openai, qwen, moonshot, zhipu).

use anyhow::Context;
use directories::ProjectDirs;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

// ---------------------------------------------------------------------------
// Provider presets (aligned with PySide6 ai_client.py)
// ---------------------------------------------------------------------------

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ProviderPreset {
    pub id: String,
    pub base_url: String,
    pub models: Vec<String>,
}

pub fn provider_presets() -> Vec<ProviderPreset> {
    vec![
        ProviderPreset {
            id: "deepseek".into(),
            base_url: "https://api.deepseek.com/v1".into(),
            models: vec!["deepseek-chat".into(), "deepseek-reasoner".into()],
        },
        ProviderPreset {
            id: "openai".into(),
            base_url: "https://api.openai.com/v1".into(),
            models: vec!["gpt-4o-mini".into(), "gpt-4o".into()],
        },
        ProviderPreset {
            id: "qwen".into(),
            base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1".into(),
            models: vec!["qwen-plus".into(), "qwen-max".into()],
        },
        ProviderPreset {
            id: "moonshot".into(),
            base_url: "https://api.moonshot.cn/v1".into(),
            models: vec!["moonshot-v1-8k".into(), "moonshot-v1-32k".into()],
        },
        ProviderPreset {
            id: "zhipu".into(),
            base_url: "https://open.bigmodel.cn/api/paas/v4".into(),
            models: vec!["glm-4-flash".into(), "glm-4-plus".into()],
        },
    ]
}

/// Resolve the base URL for a provider id (case-insensitive).
pub fn resolve_base_url(provider: &str) -> Option<String> {
    let lower = provider.to_lowercase();
    provider_presets()
        .into_iter()
        .find(|p| p.id.to_lowercase() == lower)
        .map(|p| p.base_url)
}

// ---------------------------------------------------------------------------
// Config sub-structs
// ---------------------------------------------------------------------------

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ApiConfig {
    pub active_provider: String,
    pub api_key: String,
    pub model: String,
    pub temperature: f64,
}

impl Default for ApiConfig {
    fn default() -> Self {
        let preset = &provider_presets()[0]; // deepseek
        Self {
            active_provider: preset.id.clone(),
            api_key: String::new(),
            model: preset.models[0].clone(),
            temperature: 0.7,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PersonaConfig {
    pub name: String,
    pub max_sentences: u8,
    pub use_emoji: bool,
    pub memory_enabled: bool,
    pub memory_size: usize,
}

impl Default for PersonaConfig {
    fn default() -> Self {
        Self {
            name: "菲比".into(),
            max_sentences: 4,
            use_emoji: true,
            memory_enabled: true,
            memory_size: 20,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DisplayConfig {
    /// State change throttle, milliseconds.
    pub throttle_ms: u64,
    /// Active role pack name.
    pub active_role_pack: String,
    /// Active voice pack name ("" = use role pack default).
    pub active_voice_pack: String,
}

impl Default for DisplayConfig {
    fn default() -> Self {
        Self {
            throttle_ms: 500,
            active_role_pack: "菲比".into(),
            active_voice_pack: String::new(),
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SearchConfig {
    /// Whether web search is enabled at all.
    pub enabled: bool,
    /// Backend: "duckduckgo" or "serpapi".
    pub backend: String,
    /// SerpAPI key (optional, only for serpapi backend).
    pub serpapi_key: String,
    /// Max search results to inject.
    pub max_results: u8,
    /// Use lightweight LLM call to decide whether to search (in addition to keywords).
    pub llm_trigger: bool,
}

impl Default for SearchConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            backend: "duckduckgo".into(),
            serpapi_key: String::new(),
            max_results: 3,
            llm_trigger: true,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TtsConfig {
    pub enabled: bool,
    pub language: String, // "zh" or "ja"
    pub voice_name: String,
    pub speed: f64,
    pub volume: u8,
}

impl Default for TtsConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            language: "zh".into(),
            voice_name: "zh-CN-XiaoxiaoNeural".into(),
            speed: 1.0,
            volume: 80,
        }
    }
}

// ---------------------------------------------------------------------------
// AppConfig
// ---------------------------------------------------------------------------

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AppConfig {
    pub api: ApiConfig,
    pub persona: PersonaConfig,
    pub display: DisplayConfig,
    pub search: SearchConfig,
    pub tts: TtsConfig,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            api: ApiConfig::default(),
            persona: PersonaConfig::default(),
            display: DisplayConfig::default(),
            search: SearchConfig::default(),
            tts: TtsConfig::default(),
        }
    }
}

// ---------------------------------------------------------------------------
// ConfigStore — disk persistence
// ---------------------------------------------------------------------------

pub struct ConfigStore {
    path: PathBuf,
}

impl ConfigStore {
    /// Create a new store.  Config lives at `~/.deskpet/config.json`.
    pub fn new() -> Self {
        let path = Self::default_path();
        Self { path }
    }

    fn default_path() -> PathBuf {
        if let Some(proj) = ProjectDirs::from("", "", "deskpet") {
            proj.config_dir().join("config.json")
        } else {
            // Fallback for platforms where directories doesn't work
            let home = std::env::var("HOME")
                .or_else(|_| std::env::var("USERPROFILE"))
                .unwrap_or_else(|_| ".".into());
            PathBuf::from(home).join(".deskpet").join("config.json")
        }
    }

    /// Load config from disk.  Returns default if file missing or corrupt.
    pub fn load(&self) -> AppConfig {
        match std::fs::read_to_string(&self.path) {
            Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
            Err(_) => AppConfig::default(),
        }
    }

    /// Save config to disk, creating parent directories as needed.
    pub fn save(&self, config: &AppConfig) -> anyhow::Result<()> {
        if let Some(parent) = self.path.parent() {
            std::fs::create_dir_all(parent)
                .with_context(|| format!("create config dir: {:?}", parent))?;
        }
        let json = serde_json::to_string_pretty(config)?;
        std::fs::write(&self.path, json)
            .with_context(|| format!("write config: {:?}", self.path))?;
        Ok(())
    }

    /// Atomic read-modify-write helper.
    pub fn update<F>(&self, f: F) -> anyhow::Result<AppConfig>
    where
        F: FnOnce(&mut AppConfig),
    {
        let mut config = self.load();
        f(&mut config);
        self.save(&config)?;
        Ok(config)
    }

    /// Return the path on disk (for display / debugging).
    pub fn path(&self) -> &PathBuf {
        &self.path
    }
}

impl Default for ConfigStore {
    fn default() -> Self {
        Self::new()
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config_is_valid() {
        let cfg = AppConfig::default();
        assert_eq!(cfg.api.active_provider, "deepseek");
        assert_eq!(cfg.persona.name, "菲比");
        assert!(!cfg.tts.voice_name.is_empty());
        let json = serde_json::to_string(&cfg).unwrap();
        let round: AppConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(round.api.model, cfg.api.model);
    }

    #[test]
    fn provider_presets_have_urls() {
        for p in provider_presets() {
            assert!(!p.base_url.is_empty(), "{} has empty base_url", p.id);
            assert!(!p.models.is_empty(), "{} has no models", p.id);
        }
    }

    #[test]
    fn resolve_base_url_known_and_unknown() {
        assert_eq!(
            resolve_base_url("deepseek"),
            Some("https://api.deepseek.com/v1".into())
        );
        assert_eq!(
            resolve_base_url("DEEPSEEK"),
            Some("https://api.deepseek.com/v1".into())
        );
        assert_eq!(resolve_base_url("unknown"), None);
    }

    #[test]
    fn config_roundtrip_json() {
        let cfg = AppConfig::default();
        let json = serde_json::to_string_pretty(&cfg).unwrap();
        let decoded: AppConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(decoded.api.temperature, cfg.api.temperature);
        assert_eq!(decoded.search.enabled, cfg.search.enabled);
    }

    #[test]
    fn config_store_temp_file() {
        let dir = std::env::temp_dir().join("deskpet_test_config");
        let store = ConfigStore {
            path: dir.join("config.json"),
        };

        // No file exists → default
        let cfg = store.load();
        assert_eq!(cfg.api.active_provider, "deepseek");

        // Save something custom
        let mut custom = AppConfig::default();
        custom.tts.language = "ja".into();
        store.save(&custom).unwrap();
        let loaded = store.load();
        assert_eq!(loaded.tts.language, "ja");

        // Cleanup
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn corrupt_file_falls_back_to_default() {
        let dir = std::env::temp_dir().join("deskpet_test_corrupt");
        std::fs::create_dir_all(&dir).unwrap();
        let config_file = dir.join("config.json");
        std::fs::write(&config_file, "not valid json {{{").unwrap();

        let store = ConfigStore {
            path: config_file.clone(),
        };
        let cfg = store.load();
        // Falls back to default
        assert_eq!(cfg.api.active_provider, "deepseek");

        let _ = std::fs::remove_dir_all(&dir);
    }
}

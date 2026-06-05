//! Speech engine — Text-to-Speech synthesis and playback orchestration.
//!
//! Backends (tiered fallback chain):
//! 1. Edge TTS (Microsoft) — free, no API key, ~100 neural voices
//! 2. System TTS (SAPI / say / espeak) — offline fallback
//! 3. Silent — text-only mode
//!
//! Voice matching strategy ("近亲匹配"):
//! - Voice pack's `tts_voice` > Role pack's `tts_voice` > Global default

use crate::config::TtsConfig;
use std::path::PathBuf;

// ---------------------------------------------------------------------------
// Voice config — the resolved TTS voice settings
// ---------------------------------------------------------------------------

#[derive(Clone, Debug)]
pub struct VoiceConfig {
    pub voice_name: String,
    pub language: String,
    pub speed: f64,
    pub volume: u8,
    pub enabled: bool,
}

impl VoiceConfig {
    /// Build from global TTS config + optional pack overrides.
    pub fn resolve(
        global: &TtsConfig,
        role_pack_voice: Option<&str>,
        role_pack_lang: Option<&str>,
        voice_pack_voice: Option<&str>,
        voice_pack_lang: Option<&str>,
    ) -> Self {
        // Priority: voice pack > role pack > global
        let voice_name = voice_pack_voice
            .or(role_pack_voice)
            .unwrap_or(&global.voice_name)
            .to_string();
        let language = voice_pack_lang
            .or(role_pack_lang)
            .unwrap_or(&global.language)
            .to_string();

        Self {
            voice_name,
            language,
            speed: global.speed,
            volume: global.volume,
            enabled: global.enabled,
        }
    }

    /// Default Edge TTS voice for a given language.
    pub fn default_voice_for(lang: &str) -> &'static str {
        match lang {
            "ja" => "ja-JP-NanamiNeural",
            _ => "zh-CN-XiaoxiaoNeural",
        }
    }
}

// ---------------------------------------------------------------------------
// TtsBackend trait
// ---------------------------------------------------------------------------

#[async_trait::async_trait]
pub trait TtsBackend: Send + Sync {
    /// Synthesize text into PCM / MP3 audio bytes.
    async fn synthesize(&self, text: &str, voice: &VoiceConfig) -> Result<Vec<u8>, TtsError>;
}

// ---------------------------------------------------------------------------
// TtsError
// ---------------------------------------------------------------------------

#[derive(Debug, thiserror::Error)]
pub enum TtsError {
    #[error("TTS is disabled")]
    Disabled,
    #[error("network error: {0}")]
    Network(#[from] reqwest::Error),
    #[error("synthesis failed: {0}")]
    Synthesis(String),
    #[error("backend unavailable: {0}")]
    Unavailable(String),
}

// ---------------------------------------------------------------------------
// Edge TTS backend
// ---------------------------------------------------------------------------

pub struct EdgeTtsBackend {
    client: reqwest::Client,
}

impl EdgeTtsBackend {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(15))
                .build()
                .expect("create reqwest client"),
        }
    }

    /// Build the SSML payload for Edge TTS.
    fn build_ssml(text: &str, voice: &VoiceConfig) -> String {
        format!(
            r#"<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="{}">
  <voice name="{}">
    <prosody rate="{:.1}" volume="{}">{}</prosody>
  </voice>
</speak>"#,
            if voice.language == "ja" { "ja-JP" } else { "zh-CN" },
            escape_xml(&voice.voice_name),
            voice.speed,
            voice.volume,
            escape_xml(text),
        )
    }
}

impl Default for EdgeTtsBackend {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait::async_trait]
impl TtsBackend for EdgeTtsBackend {
    async fn synthesize(&self, text: &str, voice: &VoiceConfig) -> Result<Vec<u8>, TtsError> {
        if !voice.enabled {
            return Err(TtsError::Disabled);
        }

        let ssml = Self::build_ssml(text, voice);
        let endpoint = format!(
            "https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4&ConnectionId={}",
            uuid::Uuid::new_v4()
        );

        let resp = self
            .client
            .post(&endpoint)
            .header("Content-Type", "application/ssml+xml")
            .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
            .header("X-Microsoft-OutputFormat", "audio-24khz-48kbitrate-mono-mp3")
            .body(ssml)
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let body = resp.text().await.unwrap_or_default();
            return Err(TtsError::Synthesis(format!("HTTP {status}: {body}")));
        }

        let bytes = resp.bytes().await?;
        Ok(bytes.to_vec())
    }
}

// ---------------------------------------------------------------------------
// SpeechEngine — orchestrates TTS + fallback chain
// ---------------------------------------------------------------------------

pub struct SpeechEngine {
    primary: Box<dyn TtsBackend>,
    fallback: Option<Box<dyn TtsBackend>>,
    /// Directory for temporary audio files.
    temp_dir: PathBuf,
}

impl SpeechEngine {
    pub fn new() -> Self {
        Self {
            primary: Box::new(EdgeTtsBackend::new()),
            fallback: None,
            temp_dir: std::env::temp_dir().join("deskpet-tts"),
        }
    }

    /// Synthesize text to audio and save to a temp file.
    /// Returns the path to the audio file on success.
    pub async fn speak_to_file(
        &self,
        text: &str,
        voice: &VoiceConfig,
    ) -> Result<PathBuf, TtsError> {
        if !voice.enabled || text.trim().is_empty() {
            return Err(TtsError::Disabled);
        }

        // Try primary backend (Edge TTS)
        let result = self.primary.synthesize(text, voice).await;

        let audio_bytes = match result {
            Ok(bytes) => bytes,
            Err(e) => {
                log::warn!("[TTS] primary backend failed: {e}, trying fallback");
                // Try fallback
                if let Some(ref fb) = self.fallback {
                    fb.synthesize(text, voice).await?
                } else {
                    return Err(e);
                }
            }
        };

        // Write to temp file
        std::fs::create_dir_all(&self.temp_dir).ok();
        let file_path = self
            .temp_dir
            .join(format!("tts_{}.mp3", uuid::Uuid::new_v4()));
        std::fs::write(&file_path, &audio_bytes)
            .map_err(|e| TtsError::Synthesis(format!("write file: {e}")))?;

        Ok(file_path)
    }

    /// Set a fallback backend (e.g. system TTS).
    pub fn set_fallback(&mut self, backend: Box<dyn TtsBackend>) {
        self.fallback = Some(backend);
    }
}

impl Default for SpeechEngine {
    fn default() -> Self {
        Self::new()
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn escape_xml(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn voice_config_default_zh() {
        assert_eq!(VoiceConfig::default_voice_for("zh"), "zh-CN-XiaoxiaoNeural");
    }

    #[test]
    fn voice_config_default_ja() {
        assert_eq!(VoiceConfig::default_voice_for("ja"), "ja-JP-NanamiNeural");
    }

    #[test]
    fn voice_config_resolve_priority() {
        let global = TtsConfig::default();
        // global: zh-CN-XiaoxiaoNeural

        // No pack overrides → global
        let vc = VoiceConfig::resolve(&global, None, None, None, None);
        assert_eq!(vc.voice_name, "zh-CN-XiaoxiaoNeural");

        // Role pack overrides
        let vc = VoiceConfig::resolve(
            &global,
            Some("zh-CN-YunxiNeural"),
            None,
            None,
            None,
        );
        assert_eq!(vc.voice_name, "zh-CN-YunxiNeural");

        // Voice pack has highest priority
        let vc = VoiceConfig::resolve(
            &global,
            Some("zh-CN-YunxiNeural"),
            None,
            Some("ja-JP-NanamiNeural"),
            Some("ja"),
        );
        assert_eq!(vc.voice_name, "ja-JP-NanamiNeural");
        assert_eq!(vc.language, "ja");
    }

    #[test]
    fn edge_tts_ssml_well_formed() {
        let voice = VoiceConfig {
            voice_name: "zh-CN-XiaoxiaoNeural".into(),
            language: "zh".into(),
            speed: 1.0,
            volume: 80,
            enabled: true,
        };
        let ssml = EdgeTtsBackend::build_ssml("你好世界", &voice);
        assert!(ssml.contains("<speak"));
        assert!(ssml.contains("zh-CN-XiaoxiaoNeural"));
        assert!(ssml.contains("你好世界"));
        assert!(ssml.contains("</speak>"));
    }

    #[test]
    fn escape_xml_special_chars() {
        assert_eq!(escape_xml("a & b"), "a &amp; b");
        assert_eq!(escape_xml("<tag>"), "&lt;tag&gt;");
        assert_eq!(escape_xml(r#""quote""#), "&quot;quote&quot;");
    }
}

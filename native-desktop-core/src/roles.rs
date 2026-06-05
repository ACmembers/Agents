//! Role pack & voice pack loading.
//!
//! Loads manifest.json from role/voice pack directories, builds
//! the state→image and event→audio mappings used at runtime.

use crate::state::DisplayState;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

// ---------------------------------------------------------------------------
// RolePack — a single character role pack
// ---------------------------------------------------------------------------

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RolePackManifest {
    pub name: String,
    #[serde(default)]
    pub author: String,
    #[serde(default)]
    pub version: String,
    /// State → image filename (relative to pack root).
    pub images: HashMap<String, String>,
    /// Optional TTS voice override.
    #[serde(default)]
    pub tts_voice: Option<String>,
    /// Optional TTS language override ("zh" / "ja").
    #[serde(default)]
    pub tts_language: Option<String>,
    /// Optional TTS speed factor.
    #[serde(default)]
    pub tts_speed: Option<f64>,
    /// Persona metadata for system prompt.
    #[serde(default)]
    pub persona: Option<RolePackPersona>,
    /// Voice sub-section (reference audio, model paths, etc.)
    #[serde(default)]
    pub voice: Option<RolePackVoice>,
    /// Optional state transition rules.
    #[serde(default)]
    pub state_transitions: Option<HashMap<String, Vec<String>>>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RolePackPersona {
    #[serde(default)]
    pub identity: String,
    #[serde(default)]
    pub personality: String,
    #[serde(default)]
    pub speaking_style: String,
    #[serde(default)]
    pub catchphrases: Vec<String>,
    #[serde(default)]
    pub background: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RolePackVoice {
    /// Reference audio for TTS cloning.
    #[serde(default)]
    pub reference_audio: Option<String>,
    #[serde(default)]
    pub gpt_model: Option<String>,
    #[serde(default)]
    pub sovits_model: Option<String>,
    #[serde(default)]
    pub ref_lang: Option<String>,
    #[serde(default)]
    pub text_lang: Option<String>,
}

/// Loaded role pack — ready for runtime use.
#[derive(Clone, Debug)]
pub struct RolePack {
    pub name: String,
    pub base_dir: PathBuf,
    /// DisplayState → absolute image path.
    pub images: HashMap<DisplayState, PathBuf>,
    /// TTS voice name (from manifest or default).
    pub tts_voice: Option<String>,
    pub tts_language: Option<String>,
    pub tts_speed: Option<f64>,
    /// Built system prompt fragment.
    pub persona_prompt: Option<String>,
    /// Voice reference data.
    pub voice_ref: Option<PathBuf>,
}

impl RolePack {
    /// Load a role pack from a directory containing manifest.json.
    pub fn load(base_dir: &Path) -> anyhow::Result<Self> {
        let manifest_path = base_dir.join("manifest.json");
        let content = std::fs::read_to_string(&manifest_path)
            .with_context(|| format!("read manifest: {:?}", manifest_path))?;
        let manifest: RolePackManifest = serde_json::from_str(&content)
            .with_context(|| format!("parse manifest: {:?}", manifest_path))?;

        // Build state→image map
        let mut images: HashMap<DisplayState, PathBuf> = HashMap::new();
        for (state_key, rel_path) in &manifest.images {
            if let Some(state) = DisplayState::from_llm_response(state_key) {
                let abs = base_dir.join(rel_path);
                if abs.exists() {
                    images.insert(state, abs);
                } else {
                    log::warn!("[RolePack] {}: image not found: {:?}", manifest.name, abs);
                }
            } else {
                log::warn!(
                    "[RolePack] {}: unknown state key '{}' in images",
                    manifest.name,
                    state_key
                );
            }
        }

        // Build persona prompt
        let persona_prompt = manifest.persona.as_ref().map(|p| {
            let mut parts: Vec<String> = Vec::new();
            parts.push(format!("你是{}，{}。", manifest.name, p.identity));
            if !p.background.is_empty() {
                parts.push(format!("## 背景\n{}", p.background));
            }
            if !p.personality.is_empty() {
                parts.push(format!("## 性格\n{}", p.personality));
            }
            if !p.speaking_style.is_empty() {
                parts.push(format!("## 说话风格\n{}", p.speaking_style));
            }
            if !p.catchphrases.is_empty() {
                parts.push(format!(
                    "## 经典语录\n{}",
                    p.catchphrases
                        .iter()
                        .map(|c| format!("- 「{c}」"))
                        .collect::<Vec<_>>()
                        .join("\n")
                ));
            }
            parts.join("\n\n")
        });

        // Voice reference
        let voice_ref = manifest
            .voice
            .as_ref()
            .and_then(|v| v.reference_audio.as_ref())
            .map(|rel| base_dir.join(rel))
            .filter(|p| p.exists());

        Ok(Self {
            name: manifest.name,
            base_dir: base_dir.to_path_buf(),
            images,
            tts_voice: manifest.tts_voice,
            tts_language: manifest.tts_language,
            tts_speed: manifest.tts_speed,
            persona_prompt,
            voice_ref,
        })
    }

    /// Get the image path for a given DisplayState.
    pub fn image_for(&self, state: DisplayState) -> Option<&PathBuf> {
        self.images.get(&state)
    }

    /// Check if this role pack has all 8 required states.
    pub fn has_all_states(&self) -> bool {
        [
            DisplayState::Idle,
            DisplayState::Greeting,
            DisplayState::Thinking,
            DisplayState::Happy,
            DisplayState::Sad,
            DisplayState::Surprised,
            DisplayState::Listening,
            DisplayState::Sleeping,
        ]
        .iter()
        .all(|s| self.images.contains_key(s))
    }
}

// ---------------------------------------------------------------------------
// VoicePack — event-driven audio pack
// ---------------------------------------------------------------------------

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct VoicePackManifest {
    pub name: String,
    /// TTS voice override.
    #[serde(default)]
    pub tts_voice: Option<String>,
    #[serde(default)]
    pub tts_language: Option<String>,
    /// Event → audio file list (relative to pack root).
    #[serde(default)]
    pub mappings: HashMap<String, Vec<String>>,
    /// Personality hints for system prompt.
    #[serde(default)]
    pub personality: Option<VoicePackPersonality>,
    /// AI prompt injection.
    #[serde(default)]
    pub voice_prompt: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct VoicePackPersonality {
    #[serde(default)]
    pub tone: Option<String>,
    #[serde(default)]
    pub pace: Option<String>,
    #[serde(default)]
    pub traits: Option<Vec<String>>,
}

/// Loaded voice pack.
#[derive(Clone, Debug)]
pub struct VoicePack {
    pub name: String,
    pub base_dir: PathBuf,
    /// Event name → list of absolute audio file paths.
    pub mappings: HashMap<String, Vec<PathBuf>>,
    pub tts_voice: Option<String>,
    pub tts_language: Option<String>,
    pub voice_prompt: Option<String>,
    pub personality: Option<VoicePackPersonality>,
}

impl VoicePack {
    /// Load a voice pack from a directory containing manifest.json.
    pub fn load(base_dir: &Path) -> anyhow::Result<Self> {
        let manifest_path = base_dir.join("manifest.json");
        if !manifest_path.exists() {
            anyhow::bail!("voice pack manifest not found: {:?}", manifest_path);
        }
        let content = std::fs::read_to_string(&manifest_path)?;
        let manifest: VoicePackManifest = serde_json::from_str(&content)?;

        let mut mappings: HashMap<String, Vec<PathBuf>> = HashMap::new();
        for (event, files) in &manifest.mappings {
            let paths: Vec<PathBuf> = files
                .iter()
                .map(|f| base_dir.join(f))
                .filter(|p| p.exists())
                .collect();
            if !paths.is_empty() {
                mappings.insert(event.clone(), paths);
            }
        }

        Ok(Self {
            name: manifest.name,
            base_dir: base_dir.to_path_buf(),
            mappings,
            tts_voice: manifest.tts_voice,
            tts_language: manifest.tts_language,
            voice_prompt: manifest.voice_prompt,
            personality: manifest.personality,
        })
    }

    /// Get a random audio file for an event.
    pub fn audio_for(&self, event: &str) -> Option<&PathBuf> {
        use rand::seq::SliceRandom;
        self.mappings.get(event).and_then(|files| {
            let mut rng = rand::thread_rng();
            files.choose(&mut rng)
        })
    }
}

// ---------------------------------------------------------------------------
// RoleManager — scans and manages all role/voice packs
// ---------------------------------------------------------------------------

pub struct RoleManager {
    /// All discovered role packs.
    pub roles: Vec<RolePack>,
    /// All discovered voice packs.
    pub voice_packs: Vec<VoicePack>,
    /// Active role index.
    pub active_role: usize,
    /// Active voice pack index (None = use role's built-in TTS).
    pub active_voice: Option<usize>,
}

impl RoleManager {
    /// Scan the roles directory and load all role packs.
    pub fn scan(roles_dir: &Path) -> Self {
        let mut roles: Vec<RolePack> = Vec::new();
        let mut voice_packs: Vec<VoicePack> = Vec::new();

        if let Ok(entries) = std::fs::read_dir(roles_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if !path.is_dir() {
                    continue;
                }
                // Try role pack
                if path.join("manifest.json").exists() {
                    match RolePack::load(&path) {
                        Ok(rp) => {
                            log::info!("[RoleManager] loaded role: {}", rp.name);
                            roles.push(rp);
                        }
                        Err(e) => {
                            log::warn!("[RoleManager] failed to load role {:?}: {e}", path);
                        }
                    }
                }
                // Also check voice_packs sub-dir
                let vp_dir = path.join("voice_pack");
                if vp_dir.is_dir() && vp_dir.join("manifest.json").exists() {
                    match VoicePack::load(&vp_dir) {
                        Ok(vp) => {
                            log::info!("[RoleManager] loaded voice pack: {}", vp.name);
                            voice_packs.push(vp);
                        }
                        Err(e) => {
                            log::warn!("[RoleManager] failed to load voice pack {:?}: {e}", vp_dir);
                        }
                    }
                }
            }
        }

        // Default: first role active
        let active_role = if roles.is_empty() { 0 } else { 0 };

        Self {
            roles,
            voice_packs,
            active_role,
            active_voice: None,
        }
    }

    /// Get the currently active role pack.
    pub fn active_role_pack(&self) -> Option<&RolePack> {
        self.roles.get(self.active_role)
    }

    /// Get the currently active voice pack.
    pub fn active_voice_pack(&self) -> Option<&VoicePack> {
        self.active_voice.and_then(|i| self.voice_packs.get(i))
    }

    /// Get the resolved TTS voice (voice pack > role pack > None).
    pub fn resolved_tts_voice(&self) -> Option<String> {
        self.active_voice_pack()
            .and_then(|vp| vp.tts_voice.clone())
            .or_else(|| self.active_role_pack().and_then(|rp| rp.tts_voice.clone()))
    }

    /// Get the resolved TTS language.
    pub fn resolved_tts_language(&self) -> Option<String> {
        self.active_voice_pack()
            .and_then(|vp| vp.tts_language.clone())
            .or_else(|| self.active_role_pack().and_then(|rp| rp.tts_language.clone()))
    }

    /// Switch active role by name.
    pub fn set_active_role(&mut self, name: &str) -> bool {
        if let Some(i) = self.roles.iter().position(|r| r.name == name) {
            self.active_role = i;
            log::info!("[RoleManager] switched to role: {name}");
            true
        } else {
            log::warn!("[RoleManager] role not found: {name}");
            false
        }
    }

    /// Switch active voice pack by name.
    pub fn set_active_voice(&mut self, name: &str) -> bool {
        if name.is_empty() {
            self.active_voice = None;
            return true;
        }
        if let Some(i) = self.voice_packs.iter().position(|v| v.name == name) {
            self.active_voice = Some(i);
            log::info!("[RoleManager] switched to voice pack: {name}");
            true
        } else {
            log::warn!("[RoleManager] voice pack not found: {name}");
            false
        }
    }

    /// List all role pack names.
    pub fn list_roles(&self) -> Vec<&str> {
        self.roles.iter().map(|r| r.name.as_str()).collect()
    }

    /// List all voice pack names.
    pub fn list_voice_packs(&self) -> Vec<&str> {
        self.voice_packs.iter().map(|v| v.name.as_str()).collect()
    }
}

use anyhow::Context;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn make_test_role_dir(name: &str, tts_voice: Option<&str>) -> (tempfile::TempDir, PathBuf) {
        let dir = tempfile::tempdir().unwrap();
        let manifest = serde_json::json!({
            "name": name,
            "author": "test",
            "version": "1.0",
            "images": {
                "idle": "idle.png",
                "greeting": "greeting.png",
                "thinking": "thinking.png",
                "happy": "happy.png",
                "sad": "sad.png",
                "surprised": "surprised.png",
                "listening": "listening.png",
                "sleeping": "sleeping.png"
            },
            "tts_voice": tts_voice,
            "tts_language": "ja",
            "persona": {
                "identity": "test identity",
                "personality": "test personality",
                "speaking_style": "short and direct",
                "catchphrases": ["hello", "goodbye"],
                "background": "test background"
            }
        });

        let manifest_path = dir.path().join("manifest.json");
        std::fs::write(&manifest_path, manifest.to_string()).unwrap();

        // Create dummy image files
        for state in &["idle","greeting","thinking","happy","sad","surprised","listening","sleeping"]
        {
            std::fs::write(dir.path().join(format!("{state}.png")), b"dummy").unwrap();
        }

        let path = dir.path().to_path_buf();
        (dir, path)
    }

    #[test]
    fn load_role_pack_with_all_states() {
        let (_dir, path) = make_test_role_dir("TestRole", Some("ja-JP-NanamiNeural"));
        let role = RolePack::load(&path).unwrap();
        assert_eq!(role.name, "TestRole");
        assert!(role.has_all_states());
        assert_eq!(role.images.len(), 8);
        assert_eq!(role.tts_voice.as_deref(), Some("ja-JP-NanamiNeural"));
        assert_eq!(role.tts_language.as_deref(), Some("ja"));
        assert!(role.persona_prompt.is_some());
        assert!(role.persona_prompt.as_ref().unwrap().contains("test identity"));
    }

    #[test]
    fn load_role_pack_missing_image_warns() {
        let dir = tempfile::tempdir().unwrap();
        let manifest = serde_json::json!({
            "name": "Partial",
            "images": { "idle": "idle.png", "happy": "missing.png" }
        });
        std::fs::write(dir.path().join("manifest.json"), manifest.to_string()).unwrap();
        std::fs::write(dir.path().join("idle.png"), b"dummy").unwrap();
        // missing.png doesn't exist

        let role = RolePack::load(dir.path()).unwrap();
        assert_eq!(role.images.len(), 1); // only idle loaded
        assert!(!role.has_all_states());
    }

    #[test]
    fn role_manager_scans_and_activates() {
        let (_dir1, path1) = make_test_role_dir("RoleA", Some("voice-A"));
        let (_dir2, path2) = make_test_role_dir("RoleB", None);

        // Create a temp root with symlinks/copies
        let root = tempfile::tempdir().unwrap();
        std::fs::create_dir(root.path().join("RoleA")).unwrap();
        std::fs::create_dir(root.path().join("RoleB")).unwrap();
        // Copy manifest + images
        copy_dir(&path1, &root.path().join("RoleA"));
        copy_dir(&path2, &root.path().join("RoleB"));

        let mut mgr = RoleManager::scan(root.path());
        assert_eq!(mgr.roles.len(), 2);

        // First role active by default
        assert_eq!(mgr.active_role_pack().unwrap().name, "RoleA");
        assert_eq!(mgr.resolved_tts_voice().as_deref(), Some("voice-A"));

        // Switch to RoleB
        assert!(mgr.set_active_role("RoleB"));
        assert_eq!(mgr.active_role_pack().unwrap().name, "RoleB");
        assert_eq!(mgr.resolved_tts_voice(), None); // RoleB has no tts_voice
    }

    fn copy_dir(src: &Path, dst: &Path) {
        for entry in std::fs::read_dir(src).unwrap() {
            let entry = entry.unwrap();
            let from = entry.path();
            let to = dst.join(from.file_name().unwrap());
            if from.is_file() {
                std::fs::copy(&from, &to).unwrap();
            }
        }
    }
}

//! native-desktop-core: Pure Rust logic for the desktop pet.
//!
//! Modules (no Qt dependencies):
//! - `state` — DisplayState enum and StateResolver
//! - `config` — AppConfig, ConfigStore, provider presets
//! - `llm` — LlmAdapter, state extraction, system prompt builder
//! - `conversation` — ConversationContext, message history
//! - `search` — SearchAdapter, DuckDuckGo backend, trigger detection
//! - `speech` — SpeechEngine, Edge TTS backend, voice config

pub mod state;
pub mod config;
pub mod llm;
pub mod conversation;
pub mod search;
pub mod speech;

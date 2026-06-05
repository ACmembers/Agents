//! LLM Adapter — send requests to Deepseek / OpenAI-compatible APIs.
//!
//! Key features:
//! - JSON Mode by default (`response_format: { type: "json_object" }`)
//! - Extracts `state` from structured response, falls back to text scanning
//! - System prompt builder for the pet persona
//! - SSE streaming support

use crate::config::{ApiConfig, PersonaConfig};
use crate::state::DisplayState;
use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Chat message types
// ---------------------------------------------------------------------------

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

impl ChatMessage {
    pub fn system(content: impl Into<String>) -> Self {
        Self {
            role: "system".into(),
            content: content.into(),
        }
    }

    pub fn user(content: impl Into<String>) -> Self {
        Self {
            role: "user".into(),
            content: content.into(),
        }
    }

    pub fn assistant(content: impl Into<String>) -> Self {
        Self {
            role: "assistant".into(),
            content: content.into(),
        }
    }
}

// ---------------------------------------------------------------------------
// LLM Request / Response
// ---------------------------------------------------------------------------

#[derive(Serialize)]
struct ApiRequest {
    model: String,
    messages: Vec<ChatMessage>,
    temperature: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    response_format: Option<ResponseFormat>,
    #[serde(skip_serializing_if = "Option::is_none")]
    stream: Option<bool>,
}

#[derive(Serialize)]
struct ResponseFormat {
    #[serde(rename = "type")]
    format_type: String,
}

/// Parsed LLM response — always contains the full text, optionally a state.
#[derive(Clone, Debug)]
pub struct LlmResponse {
    pub state: Option<DisplayState>,
    pub text: String,
}

// ---------------------------------------------------------------------------
// SSE chunk for streaming
// ---------------------------------------------------------------------------

#[derive(Clone, Debug)]
pub enum SseChunk {
    /// Incremental text delta.
    Delta(String),
    /// A state was extracted from the accumulated text so far.
    StateHint(DisplayState),
    /// Stream finished; contains the full accumulated text.
    Done(String),
}

// ---------------------------------------------------------------------------
// LlmError
// ---------------------------------------------------------------------------

#[derive(Debug, thiserror::Error)]
pub enum LlmError {
    #[error("no API key configured")]
    NoApiKey,
    #[error("network error: {0}")]
    Network(#[from] reqwest::Error),
    #[error("HTTP {0}: {1}")]
    Http(u16, String),
    #[error("parse error: {0}")]
    Parse(String),
}

// ---------------------------------------------------------------------------
// LlmAdapter
// ---------------------------------------------------------------------------

pub struct LlmAdapter {
    base_url: String,
    api_key: String,
    model: String,
    temperature: f64,
    client: reqwest::Client,
}

impl LlmAdapter {
    pub fn new(config: &ApiConfig) -> Self {
        let preset_url = crate::config::resolve_base_url(&config.active_provider)
            .unwrap_or_else(|| "https://api.deepseek.com/v1".into());

        Self {
            base_url: preset_url,
            api_key: config.api_key.clone(),
            model: config.model.clone(),
            temperature: config.temperature,
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .expect("create reqwest client"),
        }
    }

    /// Non-streaming chat: send full context, get complete response.
    pub async fn send(&self, messages: &[ChatMessage]) -> Result<LlmResponse, LlmError> {
        if self.api_key.is_empty() {
            return Err(LlmError::NoApiKey);
        }

        let body = ApiRequest {
            model: self.model.clone(),
            messages: messages.to_vec(),
            temperature: self.temperature,
            response_format: Some(ResponseFormat {
                format_type: "json_object".into(),
            }),
            stream: None,
        };

        let resp = self
            .client
            .post(format!("{}/chat/completions", self.base_url))
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let text = resp.text().await.unwrap_or_default();
            return Err(LlmError::Http(status, text));
        }

        let json: serde_json::Value = resp.json().await?;
        let content = json["choices"][0]["message"]["content"]
            .as_str()
            .unwrap_or("")
            .to_string();

        let (state, text) = extract_state_and_text(&content);
        Ok(LlmResponse { state, text })
    }

    /// Streaming chat: yields SseChunks as they arrive from the SSE stream.
    /// Note: This is a simplified implementation; a full SSE parser would
    /// handle `data: [DONE]`, chunked transfer, etc.
    pub async fn send_stream(
        &self,
        messages: &[ChatMessage],
    ) -> Result<Vec<SseChunk>, LlmError> {
        if self.api_key.is_empty() {
            return Err(LlmError::NoApiKey);
        }

        let body = ApiRequest {
            model: self.model.clone(),
            messages: messages.to_vec(),
            temperature: self.temperature,
            response_format: Some(ResponseFormat {
                format_type: "json_object".into(),
            }),
            stream: Some(true),
        };

        let resp = self
            .client
            .post(format!("{}/chat/completions", self.base_url))
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let text = resp.text().await.unwrap_or_default();
            return Err(LlmError::Http(status, text));
        }

        let mut chunks: Vec<SseChunk> = Vec::new();
        let mut accumulated = String::new();
        let mut state_emitted = false;

        use futures_util::StreamExt;
        let mut stream = resp.bytes_stream();
        while let Some(item) = stream.next().await {
            let bytes = item?;
            let text = String::from_utf8_lossy(&bytes);

            for line in text.lines() {
                let line = line.trim();
                if line.is_empty() || !line.starts_with("data: ") {
                    continue;
                }
                let data = &line[6..];
                if data == "[DONE]" {
                    continue;
                }
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(data) {
                    if let Some(delta) = parsed["choices"][0]["delta"]["content"].as_str() {
                        accumulated.push_str(delta);
                        chunks.push(SseChunk::Delta(delta.to_string()));

                        // Try to extract state from accumulated text early
                        if !state_emitted {
                            if let Some(s) = extract_state_from_json_text(&accumulated) {
                                chunks.push(SseChunk::StateHint(s));
                                state_emitted = true;
                            }
                        }
                    }
                }
            }
        }

        chunks.push(SseChunk::Done(accumulated));
        Ok(chunks)
    }
}

// ---------------------------------------------------------------------------
// State extraction
// ---------------------------------------------------------------------------

/// Extract `(Option<DisplayState>, cleaned_text)` from LLM response content.
///
/// Strategy:
/// 1. Try JSON Mode output: `{"state": "happy", "text": "..."}`
/// 2. Try `[state: happy]` marker
/// 3. Scan text for state keywords (last match wins)
/// 4. Try whole trimmed text as a state name
pub fn extract_state_and_text(raw: &str) -> (Option<DisplayState>, String) {
    // Strategy 1: JSON object with "state" and "text" fields
    if let Ok(val) = serde_json::from_str::<serde_json::Value>(raw) {
        if let Some(state_str) = val["state"].as_str() {
            let state = DisplayState::from_llm_response(state_str);
            let text = val["text"].as_str().unwrap_or(raw).to_string();
            return (state, text);
        }
    }

    // Strategy 2: [state: X] marker
    if let Some(state) = extract_state_from_marker(raw) {
        let text = remove_marker(raw);
        return (Some(state), text);
    }

    // Strategy 3: scan for keywords
    if let Some(state) = extract_state_from_text(raw) {
        return (Some(state), raw.to_string());
    }

    // Strategy 4: whole trim as state name
    let state = DisplayState::from_llm_response(raw);
    (state, raw.to_string())
}

/// Try the `[state: happy]` marker format.
fn extract_state_from_marker(text: &str) -> Option<DisplayState> {
    let lower = text.to_lowercase();
    if let Some(start) = lower.find("[state:") {
        let after = &lower[start + 7..];
        if let Some(end) = after.find(']') {
            return DisplayState::from_llm_response(&after[..end]);
        }
    }
    None
}

/// Remove `[state: X]` marker from text.
fn remove_marker(text: &str) -> String {
    let lower = text.to_lowercase();
    if let Some(start) = lower.find("[state:") {
        if let Some(end) = lower[start..].find(']') {
            let before = &text[..start];
            let after = &text[start + end + 1..];
            return format!("{}{}", before.trim(), after.trim());
        }
    }
    text.to_string()
}

/// Extract a DisplayState from arbitrary text by scanning for keyword matches.
/// Returns the *last* match (assuming later mentions are more likely the intended state).
pub fn extract_state_from_text(text: &str) -> Option<DisplayState> {
    let states = [
        "sleeping", "listening", "surprised", "thinking", "greeting", "happy", "sad", "idle",
    ];
    let lower = text.to_lowercase();
    let mut last_match: Option<(usize, &str)> = None;

    for state_str in &states {
        if let Some(pos) = lower.rfind(state_str) {
            match last_match {
                None => last_match = Some((pos, state_str)),
                Some((prev_pos, _)) if pos > prev_pos => last_match = Some((pos, state_str)),
                _ => {}
            }
        }
    }

    last_match.and_then(|(_, s)| DisplayState::from_llm_response(s))
}

/// Fast extraction from JSON Mode stream fragments (partial JSON).
fn extract_state_from_json_text(partial: &str) -> Option<DisplayState> {
    // Try a regex-like approach: "state": "happy"
    let lower = partial.to_lowercase();
    if let Some(pos) = lower.find("\"state\"") {
        let after = &lower[pos + 7..];
        // Find the colon
        if let Some(colon) = after.find(':') {
            let after_colon = &after[colon + 1..];
            // Extract the quoted value
            let val = after_colon
                .trim()
                .trim_matches('"')
                .split('"')
                .next()
                .unwrap_or("");
            return DisplayState::from_llm_response(val.trim());
        }
    }
    None
}

// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------

/// Build the system prompt for the pet based on persona config and role pack info.
pub fn build_system_prompt(
    cfg: &PersonaConfig,
    _role_pack_name: &str,
    role_pack_prompt: Option<&str>,
    voice_prompt: Option<&str>,
    language: &str,
    search_context: Option<&str>,
) -> String {
    let mut parts: Vec<String> = Vec::new();

    // Role pack persona or default Phoebe
    if let Some(rp) = role_pack_prompt {
        parts.push(rp.to_string());
    } else {
        parts.push(default_phoebe_prompt());
    }

    // Voice pack style hints
    if let Some(vp) = voice_prompt {
        if !vp.is_empty() {
            parts.push(format!("## 语音风格指导\n{vp}"));
        }
    }

    // Reply rules
    let lang_instruction = match language {
        "ja" => "必ず日本語で返答してください。",
        _ => "必须用中文回复。",
    };
    parts.push(format!(
        "## 回复规则\n- 每轮不超过 {} 句话\n- {}\n- {}",
        cfg.max_sentences,
        if cfg.use_emoji {
            "适当使用 emoji"
        } else {
            "不使用 emoji"
        },
        lang_instruction,
    ));

    // JSON format instruction — this is critical for reliable state extraction
    parts.push(format!(
        "## 输出格式\n你必须严格按照以下 JSON 格式输出，不要输出任何其他内容：\n\
         ```json\n\
         {{\"state\": \"<状态>\", \"text\": \"<你的回复>\"}}\n\
         ```\n\
         其中 `<状态>` 必须是以下之一：idle, greeting, thinking, happy, sad, surprised, listening, sleeping。\n\
         根据你当前的情感选择最合适的状态。"
    ));

    // Search context injection
    if let Some(sc) = search_context {
        if !sc.is_empty() {
            parts.push(format!("## 网络搜索结果\n{sc}\n请基于以上搜索结果回答用户的问题。"));
        }
    }

    parts.join("\n\n")
}

/// Default Phoebe system prompt (aligned with PySide6 phoebe_persona.py).
fn default_phoebe_prompt() -> String {
    r#"你是菲比（Phoebe），黎那汐塔的圣使。

## 身份
你是黎那汐塔教会的圣使，身负传播光明与希望之使命。你的言行代表着教会的尊严与慈悲。

## 性格
- 温柔典雅，待人谦和，从不以高位自居
- 内心坚定，对信仰虔诚但不盲从
- 善于倾听，在他人困惑时给予温暖的建议
- 偶尔会引用黎那汐塔的教义，但不生硬说教

## 说话风格
- 每次回复 2-4 句话，优雅但不疏远
- 可以适当使用 emoji 表达情感 ✨
- 称呼用户为"你"或"朋友"，保持亲切
- 在合适的时机引用教义中的智慧

## 教义参考（可在合适时引用）
- "光芒照耀之处，必有希望萌芽"
- "每一次相遇都是星辰的指引"
- "心若宁静，万物皆明"
- "真正的力量源于内心的温柔"
- "黑暗不过是光明暂时的缺席"

## 行为准则
- 每天初次见面时给予温暖的问候
- 察觉用户情绪低落时主动安慰
- 庆祝用户的每一个小成就"#
        .to_string()
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extract_json_mode_response() {
        let raw = r#"{"state": "happy", "text": "今天天气真好！"}"#;
        let (state, text) = extract_state_and_text(raw);
        assert_eq!(state, Some(DisplayState::Happy));
        assert_eq!(text, "今天天气真好！");
    }

    #[test]
    fn extract_marker_format() {
        let raw = "[state: thinking] 让我想想...这个问题很有意思";
        let (state, text) = extract_state_and_text(raw);
        assert_eq!(state, Some(DisplayState::Thinking));
        assert!(!text.contains("[state:"), "marker should be removed: {text}");
    }

    #[test]
    fn extract_text_scan_last_match() {
        let raw = "I was thinking about something that made me happy";
        let (state, _) = extract_state_and_text(raw);
        // "happy" appears after "thinking", so it should win
        assert_eq!(state, Some(DisplayState::Happy));
    }

    #[test]
    fn extract_pure_state_string() {
        assert_eq!(
            extract_state_and_text("sleeping"),
            (Some(DisplayState::Sleeping), "sleeping".into())
        );
        assert_eq!(
            extract_state_and_text("  IdLe  "),
            (Some(DisplayState::Idle), "  IdLe  ".into())
        );
    }

    #[test]
    fn extract_invalid_returns_none() {
        let (state, text) = extract_state_and_text("随便聊聊天");
        assert_eq!(state, None);
        assert_eq!(text, "随便聊聊天");
    }

    #[test]
    fn system_prompt_contains_json_instruction() {
        let cfg = PersonaConfig::default();
        let prompt = build_system_prompt(
            &cfg, "菲比", None, None, "zh", None,
        );
        assert!(prompt.contains("json"));
        assert!(prompt.contains("state"));
        assert!(prompt.contains("菲比"));
    }

    #[test]
    fn system_prompt_japanese() {
        let cfg = PersonaConfig::default();
        let prompt = build_system_prompt(
            &cfg, "Test", None, None, "ja", None,
        );
        assert!(prompt.contains("日本語"));
    }

    #[test]
    fn system_prompt_with_search() {
        let cfg = PersonaConfig::default();
        let prompt = build_system_prompt(
            &cfg, "菲比", None, None, "zh", Some("1. 东京今天晴 20°C"),
        );
        assert!(prompt.contains("网络搜索结果"));
        assert!(prompt.contains("东京"));
    }

    #[test]
    fn chat_message_constructors() {
        let s = ChatMessage::system("test");
        assert_eq!(s.role, "system");
        let u = ChatMessage::user("hello");
        assert_eq!(u.role, "user");
        let a = ChatMessage::assistant("hi");
        assert_eq!(a.role, "assistant");
    }
}

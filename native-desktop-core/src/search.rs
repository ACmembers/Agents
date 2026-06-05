//! Web search adapter — fetches real-time info for LLM context injection.
//!
//! Default backend: DuckDuckGo Instant Answer API (free, no key required).
//! Optional: SerpAPI (requires API key in config).

use crate::config::SearchConfig;
use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// SearchResult
// ---------------------------------------------------------------------------

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub title: String,
    pub url: String,
    pub snippet: String,
}

impl SearchResult {
    /// Format a single result for injection into the system prompt.
    pub fn format(&self, index: usize) -> String {
        format!(
            "{}. **{}** — {} (来源: {})",
            index, self.title, self.snippet, self.url
        )
    }
}

// ---------------------------------------------------------------------------
// SearchBackend trait
// ---------------------------------------------------------------------------

#[async_trait::async_trait]
pub trait SearchBackend: Send + Sync {
    /// Perform a search and return up to `limit` results.
    async fn search(&self, query: &str, limit: u8) -> Result<Vec<SearchResult>, SearchError>;
}

// ---------------------------------------------------------------------------
// SearchError
// ---------------------------------------------------------------------------

#[derive(Debug, thiserror::Error)]
pub enum SearchError {
    #[error("network error: {0}")]
    Network(#[from] reqwest::Error),
    #[error("parse error: {0}")]
    Parse(String),
    #[error("API error: {0}")]
    Api(String),
}

// ---------------------------------------------------------------------------
// DuckDuckGo backend
// ---------------------------------------------------------------------------

pub struct DuckDuckGoBackend {
    client: reqwest::Client,
}

impl DuckDuckGoBackend {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .user_agent("deskpet/0.1 (native desktop pet)")
                .build()
                .expect("create reqwest client"),
        }
    }
}

impl Default for DuckDuckGoBackend {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait::async_trait]
impl SearchBackend for DuckDuckGoBackend {
    async fn search(&self, query: &str, limit: u8) -> Result<Vec<SearchResult>, SearchError> {
        let url = format!(
            "https://api.duckduckgo.com/?q={}&format=json&no_html=1&skip_disambig=1",
            urlencoding(query)
        );

        let resp = self.client.get(&url).send().await?;
        let json: serde_json::Value = resp.json().await?;

        let mut results: Vec<SearchResult> = Vec::new();

        // Abstract (main answer)
        if let Some(abstract_text) = json["AbstractText"].as_str() {
            if !abstract_text.is_empty() {
                results.push(SearchResult {
                    title: json["Heading"]
                        .as_str()
                        .unwrap_or("")
                        .to_string(),
                    url: json["AbstractURL"]
                        .as_str()
                        .unwrap_or("")
                        .to_string(),
                    snippet: abstract_text.to_string(),
                });
            }
        }

        // Related topics
        if let Some(topics) = json["RelatedTopics"].as_array() {
            for topic in topics {
                if results.len() >= limit as usize {
                    break;
                }
                if let Some(text) = topic["Text"].as_str() {
                    results.push(SearchResult {
                        title: String::new(),
                        url: topic["FirstURL"].as_str().unwrap_or("").to_string(),
                        snippet: text.to_string(),
                    });
                }
            }
        }

        Ok(results)
    }
}

// ---------------------------------------------------------------------------
// SearchAdapter — backend + trigger logic
// ---------------------------------------------------------------------------

pub struct SearchAdapter {
    backend: Box<dyn SearchBackend>,
    enabled: bool,
    llm_trigger: bool,
    max_results: u8,
}

impl SearchAdapter {
    /// Create a SearchAdapter from config.
    pub fn from_config(config: &SearchConfig) -> Self {
        let backend: Box<dyn SearchBackend> = match config.backend.as_str() {
            "serpapi" => Box::new(DuckDuckGoBackend::new()), // fallback for now
            _ => Box::new(DuckDuckGoBackend::new()),
        };
        Self {
            backend,
            enabled: config.enabled,
            llm_trigger: config.llm_trigger,
            max_results: config.max_results,
        }
    }

    /// Perform a search.  Returns empty vec if search is disabled.
    pub async fn search(&self, query: &str) -> Result<Vec<SearchResult>, SearchError> {
        if !self.enabled {
            return Ok(vec![]);
        }
        self.backend.search(query, self.max_results).await
    }

    /// Quick keyword-based check: does this message likely need web search?
    pub fn should_search_keywords(message: &str) -> bool {
        let lower = message.to_lowercase();
        let keywords = [
            "搜索", "查一下", "查查", "帮我查", "天气", "新闻", "最新",
            "什么是", "是谁", "怎么样", "多少钱", "股价", "汇率",
            "search", "what is", "who is", "weather", "news", "latest",
        ];
        keywords.iter().any(|k| lower.contains(k))
    }

    /// Whether to attempt LLM-based trigger (lightweight yes/no call).
    pub fn use_llm_trigger(&self) -> bool {
        self.llm_trigger && self.enabled
    }

    /// Format search results for injection into system prompt.
    pub fn format_results(results: &[SearchResult]) -> String {
        if results.is_empty() {
            return String::new();
        }
        results
            .iter()
            .enumerate()
            .map(|(i, r)| r.format(i + 1))
            .collect::<Vec<_>>()
            .join("\n")
    }
}

/// URL-encode a string (replacement for the `urlencoding` crate — simple impl).
fn urlencoding(s: &str) -> String {
    let mut out = String::with_capacity(s.len() * 3);
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char);
            }
            b' ' => out.push_str("%20"),
            _ => {
                out.push_str(&format!("%{:02X}", b));
            }
        }
    }
    out
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn format_results_empty() {
        assert_eq!(SearchAdapter::format_results(&[]), "");
    }

    #[test]
    fn format_results_multiple() {
        let results = vec![
            SearchResult {
                title: "Title1".into(),
                url: "https://a.com".into(),
                snippet: "Snippet 1".into(),
            },
            SearchResult {
                title: "Title2".into(),
                url: "https://b.com".into(),
                snippet: "Snippet 2".into(),
            },
        ];
        let formatted = SearchAdapter::format_results(&results);
        assert!(formatted.contains("Title1"));
        assert!(formatted.contains("Title2"));
        assert!(formatted.contains("1."));
        assert!(formatted.contains("2."));
    }

    #[test]
    fn search_result_format() {
        let r = SearchResult {
            title: "Test".into(),
            url: "https://example.com".into(),
            snippet: "A test result".into(),
        };
        let f = r.format(1);
        assert!(f.contains("Test"));
        assert!(f.contains("https://example.com"));
        assert!(f.contains("1."));
    }

    #[test]
    fn should_search_detects_keywords() {
        assert!(SearchAdapter::should_search_keywords("今天天气怎么样"));
        assert!(SearchAdapter::should_search_keywords("帮我查一下英伟达股价"));
        assert!(SearchAdapter::should_search_keywords("什么是量子计算"));
        assert!(SearchAdapter::should_search_keywords("latest news about AI"));
        assert!(SearchAdapter::should_search_keywords("what is rust"));
    }

    #[test]
    fn should_search_skips_casual() {
        assert!(!SearchAdapter::should_search_keywords("你好"));
        assert!(!SearchAdapter::should_search_keywords("今天心情真好"));
        assert!(!SearchAdapter::should_search_keywords("讲个笑话"));
    }

    #[test]
    fn urlencoding_spaces_and_special() {
        let encoded = urlencoding("hello world 测试");
        assert!(encoded.contains("%20"));
        assert!(!encoded.contains(" "));
    }

    #[test]
    fn disabled_adapter_returns_empty() {
        let cfg = SearchConfig {
            enabled: false,
            ..Default::default()
        };
        let adapter = SearchAdapter::from_config(&cfg);
        let rt = tokio::runtime::Runtime::new().unwrap();
        let results = rt.block_on(adapter.search("test"));
        assert!(results.unwrap().is_empty());
    }
}

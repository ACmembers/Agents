//! Conversation context — manages the message history sent to the LLM.
//!
//! Maintains a bounded ring buffer of ChatMessages with automatic trimming.

use crate::llm::ChatMessage;
use std::collections::VecDeque;

pub struct ConversationContext {
    /// The message history (excluding system prompt — that is built separately).
    messages: VecDeque<ChatMessage>,

    /// Maximum number of non-system messages to retain before trimming.
    max_history: usize,
}

impl ConversationContext {
    pub fn new(max_history: usize) -> Self {
        Self {
            messages: VecDeque::with_capacity(max_history),
            max_history,
        }
    }

    /// Add a user message to the history.
    pub fn add_user_message(&mut self, text: &str) {
        self.push(ChatMessage::user(text));
    }

    /// Add an assistant message to the history.
    pub fn add_assistant_message(&mut self, text: &str) {
        self.push(ChatMessage::assistant(text));
    }

    /// Build the full message list for an LLM request.
    ///
    /// Order: system_prompt → memory → search_context → history → current_user_message.
    pub fn build_full_context(
        &self,
        system_prompt: &str,
        memory: &[ChatMessage],
        search_context: Option<&str>,
        current_message: Option<&str>,
    ) -> Vec<ChatMessage> {
        let mut out: Vec<ChatMessage> = Vec::new();

        // 1. System prompt
        out.push(ChatMessage::system(system_prompt));

        // 2. Memory (past conversations from other sessions)
        for m in memory {
            out.push(m.clone());
        }

        // 3. Search results injected as system context
        if let Some(sc) = search_context {
            if !sc.is_empty() {
                out.push(ChatMessage::system(format!(
                    "[网络搜索结果]\n{sc}\n\n请基于以上搜索结果回答用户问题。"
                )));
            }
        }

        // 4. Current session history
        for m in &self.messages {
            out.push(m.clone());
        }

        // 5. Current user message
        if let Some(msg) = current_message {
            out.push(ChatMessage::user(msg));
        }

        out
    }

    /// Number of messages currently stored.
    pub fn len(&self) -> usize {
        self.messages.len()
    }

    pub fn is_empty(&self) -> bool {
        self.messages.is_empty()
    }

    /// Return a copy of all stored messages.
    pub fn messages(&self) -> Vec<ChatMessage> {
        self.messages.iter().cloned().collect()
    }

    /// Clear all history.
    pub fn clear(&mut self) {
        self.messages.clear();
    }

    // ----- internals -----

    fn push(&mut self, msg: ChatMessage) {
        if self.messages.len() >= self.max_history {
            self.messages.pop_front();
        }
        self.messages.push_back(msg);
    }
}

impl Default for ConversationContext {
    fn default() -> Self {
        Self::new(20)
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_context_is_empty() {
        let ctx = ConversationContext::new(20);
        assert!(ctx.is_empty());
        assert_eq!(ctx.len(), 0);
    }

    #[test]
    fn add_messages_and_build() {
        let mut ctx = ConversationContext::new(20);
        ctx.add_user_message("hello");
        ctx.add_assistant_message("hi there");

        let full = ctx.build_full_context("system", &[], None, Some("how are you?"));
        assert_eq!(full.len(), 4); // system + user + assistant + current user

        assert_eq!(full[0].role, "system");
        assert_eq!(full[1].role, "user");
        assert_eq!(full[1].content, "hello");
        assert_eq!(full[2].role, "assistant");
        assert_eq!(full[3].role, "user");
        assert_eq!(full[3].content, "how are you?");
    }

    #[test]
    fn build_with_search_context() {
        let ctx = ConversationContext::new(20);
        let full = ctx.build_full_context(
            "system",
            &[],
            Some("1. Tokyo weather: sunny 20°C"),
            Some("what's the weather?"),
        );
        // system + search system + user
        assert_eq!(full.len(), 3);
        assert!(full[1].content.contains("网络搜索结果"));
        assert!(full[1].content.contains("Tokyo"));
    }

    #[test]
    fn build_with_memory() {
        let ctx = ConversationContext::new(20);
        let memory = vec![
            ChatMessage::user("yesterday: hello"),
            ChatMessage::assistant("yesterday: hi"),
        ];
        let full = ctx.build_full_context("system", &memory, None, Some("today"));
        // system + memory(user) + memory(assistant) + user
        assert_eq!(full.len(), 4);
        assert_eq!(full[1].content, "yesterday: hello");
    }

    #[test]
    fn trim_on_overflow() {
        let mut ctx = ConversationContext::new(3);
        ctx.add_user_message("a");
        ctx.add_assistant_message("b");
        ctx.add_user_message("c");
        ctx.add_assistant_message("d"); // should evict "a"
        assert_eq!(ctx.len(), 3);
        let msgs = ctx.messages();
        assert_eq!(msgs[0].content, "b"); // "a" was removed
        assert_eq!(msgs[2].content, "d");
    }

    #[test]
    fn clear_works() {
        let mut ctx = ConversationContext::new(20);
        ctx.add_user_message("hello");
        ctx.clear();
        assert!(ctx.is_empty());
    }
}

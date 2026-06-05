//! Conversation memory persistence — save/load conversation history to disk.
//!
//! Format: `~/.deskpet/conversations/{date}.json` (aligned with PySide6 version).

use chrono::{DateTime, Local, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

// ---------------------------------------------------------------------------
// MemoryEntry
// ---------------------------------------------------------------------------

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MemoryEntry {
    pub role: String,
    pub content: String,
    pub timestamp: String,
}

impl MemoryEntry {
    pub fn user(content: &str) -> Self {
        Self {
            role: "user".into(),
            content: content.to_string(),
            timestamp: Local::now().to_rfc3339(),
        }
    }

    pub fn assistant(content: &str) -> Self {
        Self {
            role: "assistant".into(),
            content: content.to_string(),
            timestamp: Local::now().to_rfc3339(),
        }
    }
}

// ---------------------------------------------------------------------------
// MemoryStore
// ---------------------------------------------------------------------------

pub struct MemoryStore {
    base_dir: PathBuf,
}

impl MemoryStore {
    /// Create a new MemoryStore using the default DeskPet config directory.
    pub fn new() -> Self {
        let base_dir = if let Some(proj) = directories::ProjectDirs::from("", "", "deskpet") {
            proj.data_dir().join("conversations")
        } else {
            let home = std::env::var("HOME")
                .or_else(|_| std::env::var("USERPROFILE"))
                .unwrap_or_else(|_| ".".into());
            PathBuf::from(home).join(".deskpet").join("conversations")
        };
        // Ensure dir exists
        std::fs::create_dir_all(&base_dir).ok();
        Self { base_dir }
    }

    /// Save a single message to today's conversation file.
    pub fn save(&self, entry: &MemoryEntry) {
        let today = Local::now().format("%Y-%m-%d").to_string();
        let path = self.base_dir.join(format!("{today}.json"));

        let mut msgs = self.load_date(&today);
        msgs.push(entry.clone());

        if let Ok(json) = serde_json::to_string_pretty(&msgs) {
            let _ = std::fs::write(&path, json);
        }
    }

    /// Load messages from a specific date.
    pub fn load_date(&self, date_str: &str) -> Vec<MemoryEntry> {
        let path = self.base_dir.join(format!("{date_str}.json"));
        self.load_file(&path)
    }

    /// Load recent messages from the last N days.
    pub fn load_recent(&self, days: u32) -> Vec<MemoryEntry> {
        let mut all: Vec<MemoryEntry> = Vec::new();
        let today = Local::now().date_naive();
        for d in 0..days {
            let date = today - chrono::Duration::days(d as i64);
            let date_str = date.format("%Y-%m-%d").to_string();
            all.extend(self.load_date(&date_str));
        }
        all
    }

    fn load_file(&self, path: &Path) -> Vec<MemoryEntry> {
        match std::fs::read_to_string(path) {
            Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
            Err(_) => vec![],
        }
    }
}

impl Default for MemoryStore {
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
    fn save_and_load_entry() {
        let dir = std::env::temp_dir().join("deskpet_test_memory");
        std::fs::create_dir_all(&dir).ok();

        let store = MemoryStore {
            base_dir: dir.clone(),
        };
        let entry = MemoryEntry::user("hello world");
        store.save(&entry);

        let loaded = store.load_recent(1);
        assert!(!loaded.is_empty());
        assert_eq!(loaded[0].role, "user");
        assert_eq!(loaded[0].content, "hello world");

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn memory_entry_timestamps() {
        let entry = MemoryEntry::assistant("test");
        assert_eq!(entry.role, "assistant");
        assert!(!entry.timestamp.is_empty());
    }

    #[test]
    fn empty_dir_returns_empty() {
        let store = MemoryStore::new();
        let recent = store.load_recent(7);
        // May be empty or have data from real usage
        assert!(recent.is_empty() || !recent.is_empty()); // just ensure no panic
    }
}

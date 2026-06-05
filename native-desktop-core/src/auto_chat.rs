//! Auto-chat timer — periodically triggers the pet to speak unprompted.
//!
//! Uses configurable intervals with random variance, similar to PySide6's SkillScheduler.

use chrono::{DateTime, Utc};
use std::collections::HashMap;
use std::time::Duration;

// ---------------------------------------------------------------------------
// ScheduledSkill
// ---------------------------------------------------------------------------

#[derive(Clone, Debug)]
pub struct ScheduledSkill {
    pub id: String,
    pub name: String,
    pub prompt: String,
    pub interval_secs: u64,
    pub variance_secs: u64,
    pub cooldown_secs: u64,
}

impl ScheduledSkill {
    /// Pick a random interval within the variance range.
    pub fn random_interval(&self) -> Duration {
        use rand::Rng;
        let mut rng = rand::thread_rng();
        let offset: i64 = rng.gen_range(-(self.variance_secs as i64)..=(self.variance_secs as i64));
        let secs = (self.interval_secs as i64 + offset).max(60); // min 60s
        Duration::from_secs(secs as u64)
    }
}

// ---------------------------------------------------------------------------
// AutoChatScheduler
// ---------------------------------------------------------------------------

pub struct AutoChatScheduler {
    /// Registered skills.
    skills: Vec<ScheduledSkill>,
    /// Last trigger time per skill id.
    last_trigger: HashMap<String, DateTime<Utc>>,
    /// Next scheduled trigger time per skill id.
    next_trigger: HashMap<String, DateTime<Utc>>,
}

impl AutoChatScheduler {
    /// Create a new scheduler with default skills.
    pub fn new() -> Self {
        let mut s = Self {
            skills: Vec::new(),
            last_trigger: HashMap::new(),
            next_trigger: HashMap::new(),
        };

        // Default skills (aligned with PySide6)
        s.add_skill(ScheduledSkill {
            id: "water-reminder".into(),
            name: "💧 喝水提醒".into(),
            prompt: "用户已经工作了一段时间。请温柔地提醒用户喝水休息。不要生硬催促。".into(),
            interval_secs: 3600,
            variance_secs: 300,
            cooldown_secs: 1800,
        });

        s.add_skill(ScheduledSkill {
            id: "random-chat".into(),
            name: "💬 随机聊天".into(),
            prompt: "你感到有点无聊，想主动和用户聊聊天。可以分享一个小故事或问用户今天过得怎么样。".into(),
            interval_secs: 4800,
            variance_secs: 600,
            cooldown_secs: 3600,
        });

        s.add_skill(ScheduledSkill {
            id: "greeting".into(),
            name: "🌅 问候".into(),
            prompt: "你刚刚注意到用户。根据当前时间段给出合适的问候。语气要自然，像老朋友.。".into(),
            interval_secs: 28800, // 8h
            variance_secs: 1800,
            cooldown_secs: 14400,
        });

        // Initialize next_trigger times
        let now = Utc::now();
        for skill in &s.skills {
            let delay = skill.random_interval();
            s.next_trigger
                .insert(skill.id.clone(), now + delay);
        }

        s
    }

    pub fn add_skill(&mut self, skill: ScheduledSkill) {
        self.skills.push(skill);
    }

    /// Check which skills are ready to fire. Returns list of prompts.
    pub fn tick(&mut self) -> Vec<ScheduledSkill> {
        let now = Utc::now();
        let mut ready: Vec<ScheduledSkill> = Vec::new();

        for skill in &self.skills {
            // Check cooldown
            if let Some(last) = self.last_trigger.get(&skill.id) {
                let elapsed = now - *last;
                if elapsed.num_seconds() < skill.cooldown_secs as i64 {
                    continue;
                }
            }

            // Check next trigger time
            if let Some(next) = self.next_trigger.get(&skill.id) {
                if *next <= now {
                    ready.push(skill.clone());
                    self.last_trigger.insert(skill.id.clone(), now);
                    // Schedule next
                    let delay = skill.random_interval();
                    self.next_trigger.insert(skill.id.clone(), now + delay);
                }
            }
        }

        ready
    }

    /// Get all registered skill names.
    pub fn skill_names(&self) -> Vec<&str> {
        self.skills.iter().map(|s| s.name.as_str()).collect()
    }
}

impl Default for AutoChatScheduler {
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
    fn scheduler_has_default_skills() {
        let s = AutoChatScheduler::new();
        assert!(!s.skills.is_empty());
        assert!(s.skill_names().len() >= 3);
    }

    #[test]
    fn scheduler_tick_returns_empty_initially() {
        let mut s = AutoChatScheduler::new();
        // Right after creation, nothing should be due yet (durations are all > 0)
        let ready = s.tick();
        assert!(ready.is_empty());
    }

    #[test]
    fn skill_random_interval_is_positive() {
        let skill = ScheduledSkill {
            id: "test".into(),
            name: "Test".into(),
            prompt: "test".into(),
            interval_secs: 100,
            variance_secs: 50,
            cooldown_secs: 60,
        };
        let interval = skill.random_interval();
        assert!(interval.as_secs() >= 60); // min 60s
    }
}

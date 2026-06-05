//! DisplayState enum and StateResolver — the pet's emotion/status state machine.
//!
//! Design constraints (from design doc):
//! - LLM only returns a state enum string; never drives UI directly.
//! - StateResolver validates, throttles, and applies priority before adopting a new state.
//! - Role packs may override the priority map and throttle window.

use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ---------------------------------------------------------------------------
// DisplayState — the 8 canonical pet display states
// ---------------------------------------------------------------------------

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum DisplayState {
    #[default]
    Idle,
    Greeting,
    Thinking,
    Happy,
    Sad,
    Surprised,
    Listening,
    Sleeping,
}

impl DisplayState {
    /// Default priority: higher number = more important (can override lower).
    /// Sleeping (0) is the "background" state; Happy (6) is the strongest.
    pub fn default_priority(self) -> u8 {
        match self {
            DisplayState::Sleeping => 0,
            DisplayState::Idle => 1,
            DisplayState::Greeting => 2,
            DisplayState::Listening => 3,
            DisplayState::Thinking => 3,
            DisplayState::Sad => 4,
            DisplayState::Surprised => 5,
            DisplayState::Happy => 6,
        }
    }

    /// Parse from an LLM response string.  Case-insensitive, trims whitespace.
    pub fn from_llm_response(raw: &str) -> Option<Self> {
        let s = raw.trim().to_lowercase();
        match s.as_str() {
            "idle" => Some(Self::Idle),
            "greeting" => Some(Self::Greeting),
            "thinking" => Some(Self::Thinking),
            "happy" => Some(Self::Happy),
            "sad" => Some(Self::Sad),
            "surprised" => Some(Self::Surprised),
            "listening" => Some(Self::Listening),
            "sleeping" => Some(Self::Sleeping),
            _ => None,
        }
    }

    /// Human-readable label (Chinese).
    pub fn label(self) -> &'static str {
        match self {
            DisplayState::Idle => "待机",
            DisplayState::Greeting => "问候",
            DisplayState::Thinking => "思考",
            DisplayState::Happy => "开心",
            DisplayState::Sad => "难过",
            DisplayState::Surprised => "惊讶",
            DisplayState::Listening => "倾听",
            DisplayState::Sleeping => "睡觉",
        }
    }
}

impl std::fmt::Display for DisplayState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            DisplayState::Idle => "idle",
            DisplayState::Greeting => "greeting",
            DisplayState::Thinking => "thinking",
            DisplayState::Happy => "happy",
            DisplayState::Sad => "sad",
            DisplayState::Surprised => "surprised",
            DisplayState::Listening => "listening",
            DisplayState::Sleeping => "sleeping",
        };
        write!(f, "{s}")
    }
}

impl std::str::FromStr for DisplayState {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Self::from_llm_response(s).ok_or_else(|| format!("unknown state: {s}"))
    }
}

// ---------------------------------------------------------------------------
// TransitionSource — who/what triggered the state change
// ---------------------------------------------------------------------------

#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum TransitionSource {
    /// User typed / clicked
    UserInput,
    /// Timer-based skill (greeting, reminder, etc.)
    Timer,
    /// System event (startup, shutdown, config change)
    System,
    /// Force-set via debug / settings
    Force,
}

// ---------------------------------------------------------------------------
// StateTransition — a single recorded change
// ---------------------------------------------------------------------------

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct StateTransition {
    pub from: DisplayState,
    pub to: DisplayState,
    pub timestamp: chrono::DateTime<Utc>,
    pub source: TransitionSource,
}

// ---------------------------------------------------------------------------
// StateResolver — the state machine
// ---------------------------------------------------------------------------

pub struct StateResolver {
    /// Current active state.
    pub current: DisplayState,

    /// Timestamp of the last accepted state change.
    pub last_change: DateTime<Utc>,

    /// Minimum time between state changes (milliseconds).  Default: 500 ms.
    pub throttle_ms: i64,

    /// Priority look-up.  May be overridden by a role pack.
    priority_map: HashMap<DisplayState, u8>,

    /// Ring buffer of recent transitions (for debugging).
    history: std::collections::VecDeque<StateTransition>,

    /// Max history entries before rotating.
    max_history: usize,
}

impl StateResolver {
    /// Create a new resolver starting at `Idle`.
    pub fn new() -> Self {
        Self {
            current: DisplayState::Idle,
            last_change: Utc::now(),
            throttle_ms: 500,
            priority_map: Self::default_priority_map(),
            history: std::collections::VecDeque::with_capacity(100),
            max_history: 100,
        }
    }

    /// Build the default priority map.
    fn default_priority_map() -> HashMap<DisplayState, u8> {
        [
            DisplayState::Sleeping,
            DisplayState::Idle,
            DisplayState::Greeting,
            DisplayState::Listening,
            DisplayState::Thinking,
            DisplayState::Sad,
            DisplayState::Surprised,
            DisplayState::Happy,
        ]
        .into_iter()
        .map(|s| (s, s.default_priority()))
        .collect()
    }

    /// Override the priority map (e.g. from a role pack).
    pub fn set_priority_map(&mut self, map: HashMap<DisplayState, u8>) {
        self.priority_map = map;
    }

    /// Attempt to resolve a raw LLM state string into a new DisplayState,
    /// applying validation → throttle → priority → dedup checks.
    ///
    /// Returns `Some(new_state)` if the transition is accepted, `None` if
    /// rejected or unchanged.
    pub fn resolve(&mut self, raw: &str) -> Option<DisplayState> {
        // 1. Parse
        let candidate = DisplayState::from_llm_response(raw)?;

        // 2. Same as current? skip
        if candidate == self.current {
            return None;
        }

        // 3. Throttle check
        let now = Utc::now();
        let elapsed = now - self.last_change;
        if elapsed < Duration::milliseconds(self.throttle_ms) {
            return None;
        }

        // 4. Priority check: new state must have >= priority than current
        let cur_pri = self.priority_map.get(&self.current).copied().unwrap_or(0);
        let new_pri = self.priority_map.get(&candidate).copied().unwrap_or(0);
        if new_pri < cur_pri {
            return None;
        }

        // 5. Accept
        self.record_transition(candidate, TransitionSource::UserInput);
        Some(candidate)
    }

    /// Force-set a state, bypassing all checks (used for system commands).
    pub fn force_set(&mut self, state: DisplayState) {
        self.record_transition(state, TransitionSource::Force);
    }

    /// Reset the throttle timer so the next `resolve()` call won't be blocked.
    pub fn reset_throttle(&mut self) {
        self.last_change = Utc::now() - Duration::milliseconds(self.throttle_ms + 1);
    }

    /// Return a copy of the transition history.
    pub fn history(&self) -> Vec<StateTransition> {
        self.history.iter().cloned().collect()
    }

    // ----- internals -----

    fn record_transition(&mut self, to: DisplayState, source: TransitionSource) {
        let now = Utc::now();
        let transition = StateTransition {
            from: self.current,
            to,
            timestamp: now,
            source,
        };
        self.current = to;
        self.last_change = now;

        if self.history.len() >= self.max_history {
            self.history.pop_front();
        }
        self.history.push_back(transition);
    }
}

impl Default for StateResolver {
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
    fn default_state_is_idle() {
        assert_eq!(DisplayState::default(), DisplayState::Idle);
    }

    #[test]
    fn parse_all_states_case_insensitive() {
        for (input, expected) in [
            ("idle", DisplayState::Idle),
            ("IDLE", DisplayState::Idle),
            ("  Happy  ", DisplayState::Happy),
            ("sLeEpInG", DisplayState::Sleeping),
            ("greeting", DisplayState::Greeting),
            ("thinking", DisplayState::Thinking),
            ("sad", DisplayState::Sad),
            ("surprised", DisplayState::Surprised),
            ("listening", DisplayState::Listening),
        ] {
            assert_eq!(
                DisplayState::from_llm_response(input),
                Some(expected),
                "failed for '{input}'"
            );
        }
    }

    #[test]
    fn parse_invalid_returns_none() {
        assert_eq!(DisplayState::from_llm_response(""), None);
        assert_eq!(DisplayState::from_llm_response("angry"), None);
        assert_eq!(DisplayState::from_llm_response("随机状态"), None);
    }

    #[test]
    fn display_and_fromstr_roundtrip() {
        for state in [
            DisplayState::Idle,
            DisplayState::Greeting,
            DisplayState::Thinking,
            DisplayState::Happy,
            DisplayState::Sad,
            DisplayState::Surprised,
            DisplayState::Listening,
            DisplayState::Sleeping,
        ] {
            let s: String = state.to_string();
            let parsed: DisplayState = s.parse().unwrap();
            assert_eq!(state, parsed);
        }
    }

    #[test]
    fn priority_ordering() {
        assert!(DisplayState::Sleeping.default_priority() < DisplayState::Idle.default_priority());
        assert!(DisplayState::Idle.default_priority() < DisplayState::Happy.default_priority());
        assert_eq!(
            DisplayState::Thinking.default_priority(),
            DisplayState::Listening.default_priority()
        );
    }

    // --- StateResolver tests ---

    #[test]
    fn resolver_accepts_valid_transition() {
        let mut r = StateResolver::new();
        assert_eq!(r.current, DisplayState::Idle);

        // Force reset throttle so we're not blocked
        r.reset_throttle();
        let result = r.resolve("happy");
        assert_eq!(result, Some(DisplayState::Happy));
        assert_eq!(r.current, DisplayState::Happy);
    }

    #[test]
    fn resolver_rejects_same_state() {
        let mut r = StateResolver::new();
        r.force_set(DisplayState::Happy);
        let result = r.resolve("happy");
        assert_eq!(result, None);
    }

    #[test]
    fn resolver_rejects_lower_priority() {
        let mut r = StateResolver::new();
        r.force_set(DisplayState::Happy); // priority 6
        r.reset_throttle();
        // Try to go to idle (priority 1) — should be rejected
        let result = r.resolve("idle");
        assert_eq!(result, None);
        assert_eq!(r.current, DisplayState::Happy);
    }

    #[test]
    fn resolver_force_set_bypasses_checks() {
        let mut r = StateResolver::new();
        r.force_set(DisplayState::Happy); // priority 6
        r.force_set(DisplayState::Idle); // priority 1 — still accepted via force
        assert_eq!(r.current, DisplayState::Idle);
    }

    #[test]
    fn resolver_throttle_blocks_rapid_changes() {
        let mut r = StateResolver::new();
        r.reset_throttle();
        r.resolve("happy");
        // immediate second attempt blocked by throttle
        let r2 = r.resolve("sad");
        assert_eq!(r2, None);
    }

    #[test]
    fn resolver_history_grows() {
        let mut r = StateResolver::new();
        // Idle(1) → Greeting(2) passes priority
        r.reset_throttle();
        r.resolve("greeting");
        // Greeting(2) → Happy(6) passes priority
        r.reset_throttle();
        r.resolve("happy");
        let hist = r.history();
        assert_eq!(hist.len(), 2);
        assert_eq!(hist[0].from, DisplayState::Idle);
        assert_eq!(hist[0].to, DisplayState::Greeting);
        assert_eq!(hist[1].from, DisplayState::Greeting);
        assert_eq!(hist[1].to, DisplayState::Happy);
    }

    #[test]
    fn resolver_invalid_input_returns_none() {
        let mut r = StateResolver::new();
        r.reset_throttle();
        assert_eq!(r.resolve(""), None);
        assert_eq!(r.resolve("garbage"), None);
        assert_eq!(r.current, DisplayState::Idle);
    }
}

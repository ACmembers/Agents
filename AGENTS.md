# DeskPet Native — AGENTS.md

## Project Overview

DeskPet is an AI desktop pet companion. This is the **native rewrite** branch (`Third`) targeting Qt Quick/QML + Rust, replacing the original Electron/React stack.

## Architecture

```
┌────────────────────────────────────────────┐
│  QML Shell (UI Layer)                      │
│  Main.qml → PetSurface → ChatBubble/Input │
│                  → SettingsDialog          │
│                  → StateBadge (debug)      │
└──────────────┬─────────────────────────────┘
               │ AppModel (bridge)
┌──────────────▼─────────────────────────────┐
│  Rust Core (native-desktop-core)           │
│                                             │
│  app_core ── orchestrates the pipeline     │
│  ├── state       DisplayState + Resolver   │
│  ├── config      ConfigStore + presets     │
│  ├── llm         LlmAdapter + extraction   │
│  ├── conversation  Context management      │
│  ├── search      DuckDuckGo + keyword trig │
│  ├── speech      Edge TTS + fallback       │
│  ├── roles       RolePack/VoicePack loader │
│  ├── memory      Conversation persistence  │
│  └── auto_chat   Proactive chat scheduler  │
└────────────────────────────────────────────┘
```

## Build & Test

```bash
# Prerequisites: Rust (MSVC toolchain) + Qt 6.8+ (QML modules)

# Check compilation
cargo check --workspace

# Run all tests
cargo test --workspace

# Build release
cargo build --release -p native-desktop
```

**Current status**: 63 tests passing (57 core + 6 app), QML integration pending Qt linkage.

## Key Design Constraints

- LLM outputs fixed-state enum only (`idle|greeting|thinking|happy|sad|surprised|listening|sleeping`)
- StateResolver handles validation, throttle (500ms), and priority
- JSON Mode is primary LLM output format
- Role packs are resource-table driven (not hardcoded)
- Degradation chains everywhere: TTS → text-only, search fails → LLM-only, config corrupt → defaults

## Data Flow

```
User input → ConversationContext
  → should_search? → DuckDuckGo API
  → build_system_prompt (persona + voice hints + search results)
  → LlmAdapter.send() [JSON Mode]
  → extract_state_and_text()
  → StateResolver.resolve() [validate/throttle/priority]
  → SpeechEngine.synthesize() [Edge TTS → system TTS → silent]
  → QML: stateChanged + audioReady signals
```

## Role Pack Format

See `native-desktop/assets/roles/sakura/manifest.json` for example.
Minimal fields: `name`, `images` (state→filename map).
Optional: `tts_voice`, `tts_language`, `persona`, `voice`.

## Voice Matching (近亲匹配)

Priority: Voice pack's `tts_voice` > Role pack's `tts_voice` > Global config default.

## Directory Layout

```
native-desktop/          # Qt/QML shell + AppModel bridge
native-desktop-core/     # Pure Rust, no Qt dependency
native-desktop/assets/   # Role pack resources
native-desktop/ui/qml/   # QML source files
docs/alternatives/       # Future design options (not active)
```

## Technology Stack

| Layer | Tech |
|-------|------|
| UI | Qt Quick / QML 6.8 |
| Core | Rust (edition 2021) |
| HTTP | reqwest |
| Async | tokio |
| Config | serde_json + directories |
| Search | DuckDuckGo (free) |
| TTS | Edge TTS (free) |
| Bridge | AppModel (future: qmetaobject) |

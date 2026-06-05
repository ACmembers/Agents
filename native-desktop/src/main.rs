//! DeskPet Native — Rust backend + QML frontend via JSON file bridge.
//!
//! Architecture:
//!   Rust (this binary) → spawns QML → communicates via JSON files:
//!     state.json  — Rust writes pet state, QML reads every 200ms
//!     input.json  — QML writes user input, Rust polls every 200ms

use native_desktop_core::app_core::{AppCore, ProcessResult};
use native_desktop_core::state::DisplayState;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

const BRIDGE_DIR: &str = "C:/tmp/deskpet-bridge";

#[derive(Clone, Debug, Serialize, Deserialize)]
struct PetState {
    state: String,
    state_label: String,
    text: String,
    thinking: bool,
    role: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct UserInput {
    message: String,
    action: String, // "chat" | "click" | "double_click" | "switch_state"
    zone: String,
    switch_to: String,
}

fn bridge_path(filename: &str) -> PathBuf {
    PathBuf::from(BRIDGE_DIR).join(filename)
}

fn ensure_bridge_dir() {
    fs::create_dir_all(BRIDGE_DIR).ok();
}

fn mock_response(msg: &str) -> String {
    let greetings = ["你好", "こんにちは", "早上好", "晚上好", "嗨", "hi", "hello", "hey"];
    let ask = ["?", "？", "什么", "怎么", "为什么"];
    let sad = ["难过", "不开心", "累", "sad", "困"];

    let lower = msg.to_lowercase();

    if sad.iter().any(|k| lower.contains(k)) {
        "别难过... 我会一直在这里陪着你 ✨\n休息一下，喝杯水吧。".into()
    } else if ask.iter().any(|k| lower.contains(k)) {
        "嗯... 这是个好问题呢～\n不过我现在还在学习阶段，有些问题还需要主人帮忙解答 (。-ω-。)".into()
    } else if greetings.iter().any(|k| lower.contains(k)) {
        "你好呀！今天也是美好的一天呢 ✨\n有什么想聊的吗？".into()
    } else {
        "嗯嗯，我在听呢～\n虽然还不太会说话，但我会认真记住你说的每一句话 💕".into()
    }
}

fn write_state(core: &AppCore, text: &str, thinking: bool) {
    ensure_bridge_dir();
    let s = core.current_state();
    let role = core
        .role_manager
        .active_role_pack()
        .map(|r| r.name.clone())
        .unwrap_or_else(|| "夜乃桜".into());

    let state = PetState {
        state: s.to_string(),
        state_label: s.label().to_string(),
        text: text.to_string(),
        thinking,
        role,
    };

    if let Ok(json) = serde_json::to_string_pretty(&state) {
        fs::write(bridge_path("state.json"), json).ok();
    }
}

fn read_input() -> Option<UserInput> {
    let path = bridge_path("input.json");
    match fs::read_to_string(&path) {
        Ok(content) => {
            // Consume the input (delete after reading)
            let _ = fs::remove_file(&path);
            serde_json::from_str(&content).ok()
        }
        Err(_) => None,
    }
}

fn main() {
    env_logger::init();
    log::info!("[DeskPet] Starting native desktop...");

    ensure_bridge_dir();

    // Initialize core
    let core = Arc::new(Mutex::new(AppCore::new()));
    let core_clone = core.clone();

    // Write initial state
    {
        let c = core.lock().unwrap();
        write_state(&c, "", false);
    }

    // Find QML executable and App.qml path
    let qml_bin = find_qml();
    let app_qml = find_app_qml();

    log::info!("[DeskPet] QML binary: {}", qml_bin);
    log::info!("[DeskPet] App QML: {}", app_qml);

    // Spawn QML frontend process
    let mut qml_process = match Command::new(&qml_bin)
        .arg(&app_qml)
        .spawn()
    {
        Ok(child) => {
            log::info!("[DeskPet] QML process started (pid={})", child.id());
            Some(child)
        }
        Err(e) => {
            log::error!("[DeskPet] Failed to start QML: {e}");
            log::info!(
                "[DeskPet] To start manually: {} {}",
                qml_bin,
                app_qml
            );
            None
        }
    };

    // Main loop: poll input, process, write state
    log::info!("[DeskPet] Entering main loop...");
    write_status("running");

    loop {
        // Check if QML process is still alive
        if let Some(ref mut proc) = qml_process {
            match proc.try_wait() {
                Ok(Some(status)) => {
                    log::info!("[DeskPet] QML process exited: {:?}", status);
                    break;
                }
                Ok(None) => {} // still running
                Err(e) => log::warn!("[DeskPet] QML wait error: {e}"),
            }
        }

        // Poll for user input
        if let Some(input) = read_input() {
            log::info!(
                "[DeskPet] Received input: action={}, msg={}",
                input.action,
                input.message
            );

            match input.action.as_str() {
                "chat" if !input.message.is_empty() => {
                    let mut c = core.lock().unwrap();
                    write_state(&c, "思考中...", true);

                    // Mock mode: if no API key, generate local responses
                    let no_api = c.config.api.api_key.is_empty();
                    drop(c);

                    let rt = tokio::runtime::Builder::new_current_thread()
                        .enable_all()
                        .build()
                        .unwrap();

                    let mut c = core.lock().unwrap();
                    let result = if no_api {
                        // Mock response for demo
                        let mock_text = mock_response(&input.message);
                        c.state_resolver.reset_throttle();
                        c.state_resolver.resolve("happy");
                        ProcessResult {
                            state: Some(DisplayState::Happy),
                            text: mock_text,
                            audio_path: None,
                        }
                    } else {
                        rt.block_on(async {
                            tokio::time::timeout(
                                std::time::Duration::from_secs(10),
                                c.process_user_input(&input.message)
                            ).await.unwrap_or_else(|_| {
                                ProcessResult {
                                    state: None,
                                    text: "唔... 思考超时了，请稍后再试 (。-ω-。)".into(),
                                    audio_path: None,
                                }
                            })
                        })
                    };

                    if let Some(new_state) = result.state {
                        // Core already updated by process_user_input
                    }
                    write_state(&c, &result.text, false);
                }
                "switch_state" if !input.switch_to.is_empty() => {
                    let mut c = core.lock().unwrap();
                    c.set_state(&input.switch_to);
                    write_state(&c, "", false);
                }
                "click" => {
                    let c = core.lock().unwrap();
                    log::info!("[DeskPet] Click zone: {}", input.zone);
                    write_state(&c, "", false);
                }
                _ => {}
            }
        }

        thread::sleep(Duration::from_millis(200));
    }

    // Cleanup
    write_status("stopped");
    if let Some(ref mut proc) = qml_process {
        let _ = proc.kill();
    }
    log::info!("[DeskPet] Shutdown complete.");
}

fn write_status(s: &str) {
    ensure_bridge_dir();
    fs::write(bridge_path("status.txt"), s).ok();
}

fn find_qml() -> String {
    let candidates = [
        "C:/Qt/6.8.3/mingw_64/bin/qml.exe",
    ];
    for c in &candidates {
        if PathBuf::from(c).exists() {
            return c.to_string();
        }
    }
    "qml".to_string()
}

fn find_app_qml() -> String {
    // Use the junction path (pure ASCII) if available
    let candidates = [
        "C:/deskpet/native-desktop/ui/qml/App.qml",
        "native-desktop/ui/qml/App.qml",
    ];
    for c in &candidates {
        if PathBuf::from(c).exists() {
            return c.to_string();
        }
    }
    "native-desktop/ui/qml/App.qml".to_string()
}

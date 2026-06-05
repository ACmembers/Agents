//! Native desktop pet application — QML shell + Rust core.
//!
//! Architecture:
//!   main.rs → bootstrap() → creates AppModel (QObject) → loads Main.qml
//!   QML binds to AppModel properties, calls Q_INVOKABLE methods
//!   AppModel delegates to native-desktop-core for business logic

mod app;

use std::sync::Mutex;

pub use app::AppModel;

/// The shared application state passed between main thread and QML thread.
pub struct AppContext {
    pub core: native_desktop_core::state::StateResolver,
}

impl AppContext {
    pub fn new() -> Self {
        Self {
            core: native_desktop_core::state::StateResolver::new(),
        }
    }
}

fn main() {
    env_logger::init();
    app::bootstrap();
}

//! Native desktop pet application — QML shell + Rust core.
//!
//! Architecture:
//!   main.rs → bootstrap() → creates AppCore + AppModel → loads Main.qml
//!   QML binds to AppModel properties, calls Q_INVOKABLE methods
//!   AppModel delegates to native-desktop-core for business logic

mod app;

fn main() {
    env_logger::init();
    app::bootstrap();
}

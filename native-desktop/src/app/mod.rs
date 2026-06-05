//! Application bootstrap — holds the AppCore singleton and bridge helpers.

use native_desktop_core::app_core::AppCore;
use std::cell::RefCell;

thread_local! {
    static APP_CORE: RefCell<Option<AppCore>> = const { RefCell::new(None) };
}

/// Initialize the global AppCore instance.
pub fn init_core() {
    APP_CORE.with(|cell| {
        *cell.borrow_mut() = Some(AppCore::new());
    });
    log::info!("[AppCore] initialized");
}

/// Access the AppCore immutably. Panics if not initialized.
pub fn with_core<F, R>(f: F) -> R
where
    F: FnOnce(&AppCore) -> R,
{
    APP_CORE.with(|cell| {
        let core = cell.borrow();
        f(core.as_ref().expect("AppCore not initialized"))
    })
}

/// Access the AppCore mutably.
pub fn with_core_mut<F, R>(f: F) -> R
where
    F: FnOnce(&mut AppCore) -> R,
{
    APP_CORE.with(|cell| {
        let mut core = cell.borrow_mut();
        f(core.as_mut().expect("AppCore not initialized"))
    })
}

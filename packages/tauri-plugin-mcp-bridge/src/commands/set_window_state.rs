//! Window focus, minimize, and maximize (desktop only).

use tauri::{AppHandle, Runtime};

#[cfg(desktop)]
use super::list_windows::resolve_window;

/// Applies a window state action: `focus`, `minimize`, or `maximize`.
#[cfg(desktop)]
pub async fn set_window_state<R: Runtime>(
    app: AppHandle<R>,
    window_id: Option<String>,
    action: &str,
) -> Result<(), String> {
    let webview = resolve_window(&app, window_id)?;
    let window = webview.window();

    match action {
        "focus" => window.set_focus().map_err(|e| e.to_string()),
        "minimize" => window.minimize().map_err(|e| e.to_string()),
        "maximize" => window.maximize().map_err(|e| e.to_string()),
        _ => Err(format!("Unknown window state action: {action}")),
    }
}

/// Mobile implementation — returns unsupported error with clear explanation for the agent.
#[cfg(mobile)]
const MOBILE_UNSUPPORTED: &str =
    "Window focus, minimize, and maximize are not supported on mobile platforms (Android/iOS).";

#[cfg(mobile)]
pub async fn set_window_state<R: Runtime>(
    _app: AppHandle<R>,
    _window_id: Option<String>,
    action: &str,
) -> Result<(), String> {
    match action {
        "focus" | "minimize" | "maximize" => Err(MOBILE_UNSUPPORTED.to_string()),
        _ => Err(format!("Unknown window state action: {action}")),
    }
}

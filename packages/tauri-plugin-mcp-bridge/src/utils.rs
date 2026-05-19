use tauri::{Runtime, WebviewWindow};

#[cfg(target_os = "macos")]
const ENV_NO_FOREGROUND: &str = "TAURI_MCP_NO_FOREGROUND";

#[cfg(target_os = "macos")]
const NS_WINDOW_OCCLUSION_STATE_VISIBLE: usize = 1 << 1;

#[cfg(target_os = "macos")]
pub fn prepare_window_for_screenshot<R: Runtime>(window: &WebviewWindow<R>) -> Result<(), String> {
    use objc2_web_kit::WKWebView;

    if should_skip_window_foregrounding() {
        return Ok(());
    }

    window
        .with_webview(move |webview| unsafe {
            let wkwebview: &WKWebView = &*(webview.inner() as *const _ as *const WKWebView);
            let ns_window: *mut objc2::runtime::AnyObject = objc2::msg_send![wkwebview, window];

            if !ns_window.is_null() && is_window_fully_occluded(ns_window) {
                let _: () = objc2::msg_send![ns_window, orderFrontRegardless];
            }
        })
        .map_err(|e| format!("Failed to prepare webview for screenshot: {e}"))
}

#[cfg(not(target_os = "macos"))]
pub fn prepare_window_for_screenshot<R: Runtime>(_window: &WebviewWindow<R>) -> Result<(), String> {
    Ok(())
}

#[cfg(target_os = "macos")]
fn should_skip_window_foregrounding() -> bool {
    match std::env::var(ENV_NO_FOREGROUND) {
        Ok(value) => {
            let normalized = value.trim().to_ascii_lowercase();
            !matches!(normalized.as_str(), "" | "0" | "false" | "no" | "off")
        }
        Err(_) => false,
    }
}

#[cfg(target_os = "macos")]
unsafe fn is_window_fully_occluded(ns_window: *mut objc2::runtime::AnyObject) -> bool {
    let occlusion_state: usize = objc2::msg_send![ns_window, occlusionState];

    occlusion_state & NS_WINDOW_OCCLUSION_STATE_VISIBLE == 0
}

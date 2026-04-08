use tauri::{Runtime, WebviewWindow};

#[cfg(target_os = "macos")]
pub fn prepare_window_for_eval<R: Runtime>(window: &WebviewWindow<R>) -> Result<(), String> {
    use objc2_web_kit::WKWebView;

    window
        .with_webview(move |webview| unsafe {
            let wkwebview: &WKWebView = &*(webview.inner() as *const _ as *const WKWebView);
            let ns_window: *mut objc2::runtime::AnyObject = objc2::msg_send![wkwebview, window];

            if !ns_window.is_null() {
                let _: () = objc2::msg_send![ns_window, orderFrontRegardless];
            }
        })
        .map_err(|e| format!("Failed to prepare webview for eval: {e}"))
}

#[cfg(not(target_os = "macos"))]
pub fn prepare_window_for_eval<R: Runtime>(_window: &WebviewWindow<R>) -> Result<(), String> {
    Ok(())
}

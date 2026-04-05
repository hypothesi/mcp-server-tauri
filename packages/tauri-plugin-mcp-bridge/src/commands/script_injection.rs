//! Script injection command for re-injecting registered scripts on page load.

use crate::script_registry::{ScriptEntry, ScriptType, SharedScriptRegistry};
use tauri::{command, Runtime, State, WebviewWindow};

/// Request script injection - called by bridge.js when a page loads.
/// This command retrieves all registered scripts and injects them into the webview.
#[command]
pub async fn request_script_injection<R: Runtime>(
    window: WebviewWindow<R>,
    registry: State<'_, SharedScriptRegistry>,
) -> Result<serde_json::Value, String> {
    let scripts: Vec<ScriptEntry> = {
        let reg = registry
            .lock()
            .map_err(|e| format!("Failed to lock registry: {e}"))?;
        reg.get_all().iter().map(|e| (*e).clone()).collect()
    };

    if scripts.is_empty() {
        return Ok(serde_json::json!({
            "injected": 0,
            "message": "No scripts registered"
        }));
    }

    // Build the injection script
    let scripts_json: Vec<serde_json::Value> = scripts
        .iter()
        .map(|entry| {
            serde_json::json!({
                "id": entry.id,
                "type": match entry.script_type {
                    ScriptType::Inline => "inline",
                    ScriptType::Url => "url",
                },
                "content": entry.content
            })
        })
        .collect();

    let inject_script = format!(
        "if (window.__MCP_INJECT_SCRIPTS__) {{ window.__MCP_INJECT_SCRIPTS__({}); }}",
        serde_json::to_string(&scripts_json).unwrap_or_else(|_| "[]".to_string())
    );

    prepare_window_for_eval(&window)?;

    window
        .eval(&inject_script)
        .map_err(|e| format!("Failed to inject scripts: {e}"))?;

    Ok(serde_json::json!({
        "injected": scripts.len(),
        "scriptIds": scripts.iter().map(|s| s.id.clone()).collect::<Vec<_>>()
    }))
}

#[cfg(target_os = "macos")]
fn prepare_window_for_eval<R: Runtime>(window: &WebviewWindow<R>) -> Result<(), String> {
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
fn prepare_window_for_eval<R: Runtime>(_window: &WebviewWindow<R>) -> Result<(), String> {
    Ok(())
}

//! Native Windows dialog discovery and interaction.
//!
//! UI Automation objects are apartment-bound. The platform implementation keeps
//! every COM object on a dedicated MTA thread and exposes only serializable data
//! and opaque element references to the WebSocket layer.

use serde::Serialize;
use std::time::Duration;

#[cfg(not(target_os = "windows"))]
mod unsupported;
#[cfg(target_os = "windows")]
mod windows;

#[cfg(not(target_os = "windows"))]
pub use unsupported::NativeDialogAutomation;
#[cfg(target_os = "windows")]
pub use windows::NativeDialogAutomation;

/// Maximum time a caller may ask the UI Automation worker to wait.
pub const MAX_TIMEOUT: Duration = Duration::from_secs(10);

/// A request to discover dialogs in the ownership chain of a Tauri window.
#[derive(Debug, Clone)]
pub struct SnapshotRequest {
    pub process_id: u32,
    pub owner_window: usize,
    pub scope_id: String,
    pub min_owner_depth: usize,
    pub timeout: Duration,
}

/// A semantic action supported by a UI Automation control pattern.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum NativeDialogAction {
    Invoke,
    SetValue,
    SetPaths,
    Select,
}

impl NativeDialogAction {
    /// Parses the public WebSocket action name without including command data in errors.
    pub fn parse(value: &str) -> Result<Self, String> {
        match value {
            "invoke" => Ok(Self::Invoke),
            "setValue" => Ok(Self::SetValue),
            "setPaths" => Ok(Self::SetPaths),
            "select" => Ok(Self::Select),
            _ => Err("Unsupported native dialog action".to_string()),
        }
    }
}

/// A request to interact with an element from the latest snapshot in a session.
#[derive(Debug, Clone)]
pub struct InteractRequest {
    pub process_id: u32,
    pub owner_window: usize,
    pub scope_id: String,
    pub element_ref: String,
    pub action: NativeDialogAction,
    pub value: Option<String>,
    pub paths: Option<Vec<String>>,
    pub timeout: Duration,
}

/// Semantic metadata for a native dialog control.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeDialogControl {
    pub element_ref: Option<String>,
    pub control_type: String,
    pub name: String,
    pub automation_id: String,
    pub semantic_role: Option<String>,
    pub enabled: bool,
    pub offscreen: bool,
    pub depth: usize,
    pub supported_actions: Vec<NativeDialogAction>,
}

/// A bounded semantic snapshot of one native dialog.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeDialog {
    pub dialog_ref: String,
    pub parent_dialog_ref: Option<String>,
    pub owner_depth: usize,
    pub kind: String,
    pub title: String,
    pub automation_id: String,
    pub controls: Vec<NativeDialogControl>,
    pub truncated: bool,
}

/// Snapshot returned to the MCP server.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeDialogSnapshot {
    pub platform: &'static str,
    pub interactive_desktop_required: bool,
    pub dialogs: Vec<NativeDialog>,
    pub dialog_count: usize,
}

/// Result of applying a UI Automation control pattern.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeDialogInteractionResult {
    pub action: NativeDialogAction,
    pub element_ref: String,
    pub references_invalidated: bool,
}

pub(crate) fn bounded_timeout(timeout: Duration) -> Duration {
    timeout.min(MAX_TIMEOUT)
}

use super::{
    bounded_timeout, InteractRequest, NativeDialog, NativeDialogAction, NativeDialogControl,
    NativeDialogInteractionResult, NativeDialogSnapshot, SnapshotRequest,
};
use std::collections::{HashMap, HashSet, VecDeque};
use std::path::Path;
use std::sync::mpsc::{self, Receiver, RecvTimeoutError, SyncSender, TrySendError};
use std::thread;
use std::time::{Duration, Instant};
use uuid::Uuid;
use windows::core::{BOOL, BSTR};
use windows::Win32::Foundation::{HWND, LPARAM};
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_INPROC_SERVER, COINIT_MULTITHREADED,
};
use windows::Win32::UI::Accessibility::{
    CUIAutomation, IUIAutomation, IUIAutomationElement, IUIAutomationInvokePattern,
    IUIAutomationSelectionItemPattern, IUIAutomationValuePattern, UIA_ButtonControlTypeId,
    UIA_CheckBoxControlTypeId, UIA_ComboBoxControlTypeId, UIA_DataItemControlTypeId,
    UIA_EditControlTypeId, UIA_InvokePatternId, UIA_ListItemControlTypeId, UIA_PaneControlTypeId,
    UIA_RadioButtonControlTypeId, UIA_SelectionItemPatternId, UIA_TextControlTypeId,
    UIA_TreeItemControlTypeId, UIA_ValuePatternId, UIA_WindowControlTypeId,
};
use windows::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GetWindow, GetWindowThreadProcessId, IsWindow, IsWindowVisible, GW_OWNER,
};

const MAX_DIALOGS: usize = 4;
const MAX_ENUMERATED_DIALOGS: usize = 32;
const MAX_CONTROLS_PER_DIALOG: usize = 128;
const MAX_DEPTH: usize = 12;
const MAX_OWNER_CHAIN_DEPTH: usize = 8;
const MAX_MULTI_SELECT_PATHS: usize = 100;
const MAX_TEXT_CHARS: usize = 256;
const MAX_PATH_CHARS: usize = 32_767;
const REQUEST_QUEUE_CAPACITY: usize = 16;
const POLL_INTERVAL: Duration = Duration::from_millis(50);
const ELEMENT_REFERENCE_TTL: Duration = Duration::from_secs(30);
const STALE_REFERENCE_ERROR: &str =
    "Stale native dialog element reference; take a new native_dialog_snapshot";

enum WorkerRequest {
    Snapshot {
        request: SnapshotRequest,
        response: SyncSender<Result<NativeDialogSnapshot, String>>,
    },
    Interact {
        request: InteractRequest,
        response: SyncSender<Result<NativeDialogInteractionResult, String>>,
    },
}

/// Request-channel facade for a dedicated UI Automation MTA thread.
#[derive(Clone)]
pub struct NativeDialogAutomation {
    sender: Option<SyncSender<WorkerRequest>>,
    startup_error: Option<String>,
}

impl Default for NativeDialogAutomation {
    fn default() -> Self {
        Self::new()
    }
}

impl NativeDialogAutomation {
    pub fn new() -> Self {
        let (sender, receiver) = mpsc::sync_channel(REQUEST_QUEUE_CAPACITY);
        let spawn_result = thread::Builder::new()
            .name("tauri-mcp-uia-mta".to_string())
            .spawn(move || run_worker(receiver));

        match spawn_result {
            Ok(_) => Self {
                sender: Some(sender),
                startup_error: None,
            },
            Err(_) => Self {
                sender: None,
                startup_error: Some(
                    "Failed to start the native dialog automation thread".to_string(),
                ),
            },
        }
    }

    pub fn snapshot(&self, request: SnapshotRequest) -> Result<NativeDialogSnapshot, String> {
        let timeout = bounded_timeout(request.timeout);
        let (response_tx, response_rx) = mpsc::sync_channel(1);
        let Some(sender) = &self.sender else {
            return Err(self
                .startup_error
                .clone()
                .unwrap_or_else(|| "Native dialog automation is unavailable".to_string()));
        };

        sender
            .try_send(WorkerRequest::Snapshot {
                request,
                response: response_tx,
            })
            .map_err(request_queue_error)?;

        response_rx
            .recv_timeout(timeout + Duration::from_secs(1))
            .map_err(|_| "Native dialog snapshot timed out".to_string())?
    }

    pub fn interact(
        &self,
        request: InteractRequest,
    ) -> Result<NativeDialogInteractionResult, String> {
        let timeout = bounded_timeout(request.timeout);
        let (response_tx, response_rx) = mpsc::sync_channel(1);
        let Some(sender) = &self.sender else {
            return Err(self
                .startup_error
                .clone()
                .unwrap_or_else(|| "Native dialog automation is unavailable".to_string()));
        };

        sender
            .try_send(WorkerRequest::Interact {
                request,
                response: response_tx,
            })
            .map_err(request_queue_error)?;

        response_rx
            .recv_timeout(timeout + Duration::from_secs(1))
            .map_err(|_| "Native dialog interaction timed out".to_string())?
    }
}

fn request_queue_error(error: TrySendError<WorkerRequest>) -> String {
    match error {
        TrySendError::Full(_) => "Native dialog automation is busy; retry the request".to_string(),
        TrySendError::Disconnected(_) => {
            "Native dialog automation thread stopped unexpectedly".to_string()
        }
    }
}

fn run_worker(receiver: Receiver<WorkerRequest>) {
    let initialization = unsafe { initialize_worker() };

    match initialization {
        Ok(mut worker) => {
            loop {
                match receiver.recv_timeout(Duration::from_secs(1)) {
                    Ok(WorkerRequest::Snapshot { request, response }) => {
                        let _ = response.send(worker.snapshot(request));
                    }
                    Ok(WorkerRequest::Interact { request, response }) => {
                        let _ = response.send(worker.interact(request));
                    }
                    Err(RecvTimeoutError::Timeout) => worker.purge_expired(),
                    Err(RecvTimeoutError::Disconnected) => break,
                }
            }
            drop(worker);
            unsafe { CoUninitialize() };
        }
        Err(error) => {
            while let Ok(request) = receiver.recv() {
                match request {
                    WorkerRequest::Snapshot { response, .. } => {
                        let _ = response.send(Err(error.clone()));
                    }
                    WorkerRequest::Interact { response, .. } => {
                        let _ = response.send(Err(error.clone()));
                    }
                }
            }
        }
    }
}

unsafe fn initialize_worker() -> Result<NativeDialogWorker, String> {
    CoInitializeEx(None, COINIT_MULTITHREADED)
        .ok()
        .map_err(|error| hresult_error("COM MTA initialization", &error))?;

    let automation: IUIAutomation = CoCreateInstance(&CUIAutomation, None, CLSCTX_INPROC_SERVER)
        .map_err(|error| {
            CoUninitialize();
            hresult_error("UI Automation initialization", &error)
        })?;

    Ok(NativeDialogWorker {
        automation,
        elements: HashMap::new(),
    })
}

struct CachedElement {
    element: IUIAutomationElement,
    dialog_window: HWND,
    process_id: u32,
    owner_window: HWND,
    scope_id: String,
    supported_actions: Vec<NativeDialogAction>,
    expires_at: Instant,
}

impl Clone for CachedElement {
    fn clone(&self) -> Self {
        Self {
            element: self.element.clone(),
            dialog_window: self.dialog_window,
            process_id: self.process_id,
            owner_window: self.owner_window,
            scope_id: self.scope_id.clone(),
            supported_actions: self.supported_actions.clone(),
            expires_at: self.expires_at,
        }
    }
}

struct NativeDialogWorker {
    automation: IUIAutomation,
    elements: HashMap<String, CachedElement>,
}

impl NativeDialogWorker {
    fn snapshot(&mut self, request: SnapshotRequest) -> Result<NativeDialogSnapshot, String> {
        self.elements.clear();
        let timeout = bounded_timeout(request.timeout);
        let deadline = Instant::now() + timeout;

        loop {
            let dialogs = self.collect_dialogs(&request, deadline)?;
            if !dialogs.is_empty() {
                return Ok(NativeDialogSnapshot {
                    platform: "windows",
                    interactive_desktop_required: true,
                    dialog_count: dialogs.len(),
                    dialogs,
                });
            }

            if Instant::now() >= deadline {
                return Err(format!(
                    "No native dialog owned by the targeted Tauri window appeared within {} ms",
                    timeout.as_millis()
                ));
            }

            thread::sleep(POLL_INTERVAL.min(deadline.saturating_duration_since(Instant::now())));
        }
    }

    fn collect_dialogs(
        &mut self,
        request: &SnapshotRequest,
        deadline: Instant,
    ) -> Result<Vec<NativeDialog>, String> {
        let owner_window = hwnd_from_usize(request.owner_window);
        let dialog_windows = enumerate_owned_dialog_windows(owner_window, request.process_id)?;
        let selected_windows: Vec<OwnedDialogWindow> = dialog_windows
            .into_iter()
            .filter(|dialog| dialog.owner_depth >= request.min_owner_depth)
            .take(MAX_DIALOGS)
            .collect();
        let dialog_refs: HashMap<usize, String> = selected_windows
            .iter()
            .map(|dialog| {
                (
                    hwnd_as_usize(dialog.window),
                    format!("dialog_{}", Uuid::new_v4()),
                )
            })
            .collect();
        let mut dialogs = Vec::with_capacity(selected_windows.len());

        for owned_dialog in selected_windows {
            if Instant::now() >= deadline {
                return Err("Native dialog snapshot timed out during bounded traversal".to_string());
            }
            let dialog_window = owned_dialog.window;

            let root = unsafe { self.automation.ElementFromHandle(dialog_window) }.map_err(|error| {
                hresult_error(
                    "UI Automation could not access the native dialog; an interactive desktop is required",
                    &error,
                )
            })?;

            let current_process = unsafe { root.CurrentProcessId() }.unwrap_or_default();
            if current_process != request.process_id as i32 {
                continue;
            }

            let title = bounded_bstr(unsafe { root.CurrentName() });
            let automation_id = bounded_bstr(unsafe { root.CurrentAutomationId() });
            let (mut controls, truncated) =
                self.collect_controls(&root, dialog_window, owner_window, request, deadline)?;
            let kind = infer_dialog_kind(&controls).to_string();
            if kind == "file" {
                controls.retain(is_supported_file_dialog_control);
                let retained_refs: HashSet<&str> = controls
                    .iter()
                    .filter_map(|control| control.element_ref.as_deref())
                    .collect();
                self.elements.retain(|element_ref, cached| {
                    cached.dialog_window != dialog_window
                        || retained_refs.contains(element_ref.as_str())
                });
            }
            if controls.iter().all(|control| control.element_ref.is_none()) {
                continue;
            }

            dialogs.push(NativeDialog {
                dialog_ref: dialog_refs
                    .get(&hwnd_as_usize(dialog_window))
                    .cloned()
                    .unwrap_or_else(|| format!("dialog_{}", Uuid::new_v4())),
                parent_dialog_ref: owned_dialog
                    .immediate_owner
                    .and_then(|owner| dialog_refs.get(&hwnd_as_usize(owner)).cloned()),
                owner_depth: owned_dialog.owner_depth,
                kind,
                title,
                automation_id,
                controls,
                truncated,
            });
        }

        Ok(dialogs)
    }

    fn collect_controls(
        &mut self,
        root: &IUIAutomationElement,
        dialog_window: HWND,
        owner_window: HWND,
        request: &SnapshotRequest,
        deadline: Instant,
    ) -> Result<(Vec<NativeDialogControl>, bool), String> {
        let walker = unsafe { self.automation.ControlViewWalker() }
            .map_err(|error| hresult_error("UI Automation tree walker creation", &error))?;
        let mut queue = VecDeque::new();
        if let Ok(child) = unsafe { walker.GetFirstChildElement(root) } {
            queue.push_back((child, 0));
        }

        let mut controls = Vec::new();
        let mut visited = 0;
        let mut truncated = false;

        while let Some((element, depth)) = queue.pop_front() {
            if Instant::now() >= deadline {
                return Err("Native dialog snapshot timed out during bounded traversal".to_string());
            }
            if visited >= MAX_CONTROLS_PER_DIALOG {
                truncated = true;
                break;
            }
            visited += 1;

            let process_id = unsafe { element.CurrentProcessId() }.unwrap_or_default();
            if process_id == request.process_id as i32 {
                let control =
                    self.describe_control(&element, dialog_window, owner_window, request, depth);
                controls.push(control);
            }

            if depth < MAX_DEPTH {
                if let Ok(child) = unsafe { walker.GetFirstChildElement(&element) } {
                    queue.push_back((child, depth + 1));
                }
            } else {
                truncated = true;
            }

            if let Ok(sibling) = unsafe { walker.GetNextSiblingElement(&element) } {
                queue.push_back((sibling, depth));
            }
        }

        Ok((controls, truncated))
    }

    fn describe_control(
        &mut self,
        element: &IUIAutomationElement,
        dialog_window: HWND,
        owner_window: HWND,
        request: &SnapshotRequest,
        depth: usize,
    ) -> NativeDialogControl {
        let control_type = unsafe { element.CurrentControlType() }.unwrap_or_default();
        let control_type_name = control_type_name(control_type.0);
        let is_password = unsafe { element.CurrentIsPassword() }
            .map(|value| value.as_bool())
            .unwrap_or(false);
        let name = if is_password {
            String::new()
        } else {
            bounded_bstr(unsafe { element.CurrentName() })
        };
        let automation_id = bounded_bstr(unsafe { element.CurrentAutomationId() });
        let supported_actions = supported_actions(element, control_type.0, &automation_id);
        let semantic_role = infer_semantic_role(control_type.0, &automation_id, &supported_actions);
        let enabled = unsafe { element.CurrentIsEnabled() }
            .map(|value| value.as_bool())
            .unwrap_or(false);
        let offscreen = unsafe { element.CurrentIsOffscreen() }
            .map(|value| value.as_bool())
            .unwrap_or(false);

        let element_ref = if supported_actions.is_empty() || is_password {
            None
        } else {
            let element_ref = format!("native_{}", Uuid::new_v4());
            self.elements.insert(
                element_ref.clone(),
                CachedElement {
                    element: element.clone(),
                    dialog_window,
                    process_id: request.process_id,
                    owner_window,
                    scope_id: request.scope_id.clone(),
                    supported_actions: supported_actions.clone(),
                    expires_at: Instant::now() + ELEMENT_REFERENCE_TTL,
                },
            );
            Some(element_ref)
        };

        NativeDialogControl {
            element_ref,
            control_type: control_type_name.to_string(),
            name,
            automation_id,
            semantic_role,
            enabled,
            offscreen,
            depth,
            supported_actions,
        }
    }

    fn interact(
        &mut self,
        request: InteractRequest,
    ) -> Result<NativeDialogInteractionResult, String> {
        self.purge_expired();
        let Some(cached) = self.elements.get(&request.element_ref).cloned() else {
            return Err(STALE_REFERENCE_ERROR.to_string());
        };
        let owner_window = hwnd_from_usize(request.owner_window);
        if cached.scope_id != request.scope_id
            || cached.process_id != request.process_id
            || cached.owner_window != owner_window
            || !is_within_security_boundary(
                cached.process_id,
                request.process_id,
                cached.owner_window,
                owner_window,
            )
            || !is_owned_dialog_window(cached.dialog_window, owner_window, request.process_id)
        {
            self.elements.remove(&request.element_ref);
            return Err(STALE_REFERENCE_ERROR.to_string());
        }

        let element_process = unsafe { cached.element.CurrentProcessId() }.map_err(|_| {
            self.elements.remove(&request.element_ref);
            STALE_REFERENCE_ERROR.to_string()
        })?;
        if element_process != request.process_id as i32
            || !cached.supported_actions.contains(&request.action)
        {
            self.elements.remove(&request.element_ref);
            return Err(STALE_REFERENCE_ERROR.to_string());
        }

        match request.action {
            NativeDialogAction::Invoke => {
                let pattern: IUIAutomationInvokePattern =
                    unsafe { cached.element.GetCurrentPatternAs(UIA_InvokePatternId) }
                        .map_err(|error| self.interaction_error(cached.dialog_window, &error))?;
                unsafe { pattern.Invoke() }
                    .map_err(|error| self.interaction_error(cached.dialog_window, &error))?;
            }
            NativeDialogAction::SetValue => {
                let value = request
                    .value
                    .as_deref()
                    .ok_or_else(|| "setValue requires a complete absolute path".to_string())?;
                validate_absolute_path(value)?;
                let pattern: IUIAutomationValuePattern =
                    unsafe { cached.element.GetCurrentPatternAs(UIA_ValuePatternId) }
                        .map_err(|error| self.interaction_error(cached.dialog_window, &error))?;
                let value = BSTR::from(value);
                unsafe { pattern.SetValue(&value) }
                    .map_err(|error| self.interaction_error(cached.dialog_window, &error))?;
            }
            NativeDialogAction::SetPaths => {
                let paths = request.paths.as_deref().ok_or_else(|| {
                    "setPaths requires one or more absolute file paths".to_string()
                })?;
                let formatted_paths = format_multi_select_paths(paths)?;
                let pattern: IUIAutomationValuePattern =
                    unsafe { cached.element.GetCurrentPatternAs(UIA_ValuePatternId) }
                        .map_err(|error| self.interaction_error(cached.dialog_window, &error))?;
                let value = BSTR::from(formatted_paths);
                unsafe { pattern.SetValue(&value) }
                    .map_err(|error| self.interaction_error(cached.dialog_window, &error))?;
            }
            NativeDialogAction::Select => {
                let pattern: IUIAutomationSelectionItemPattern = unsafe {
                    cached
                        .element
                        .GetCurrentPatternAs(UIA_SelectionItemPatternId)
                }
                .map_err(|error| self.interaction_error(cached.dialog_window, &error))?;
                unsafe { pattern.Select() }
                    .map_err(|error| self.interaction_error(cached.dialog_window, &error))?;
            }
        }

        let references_invalidated = !matches!(
            request.action,
            NativeDialogAction::SetValue | NativeDialogAction::SetPaths
        );
        if references_invalidated {
            self.elements
                .retain(|_, item| item.dialog_window != cached.dialog_window);
        }

        Ok(NativeDialogInteractionResult {
            action: request.action,
            element_ref: request.element_ref,
            references_invalidated,
        })
    }

    fn interaction_error(&mut self, dialog_window: HWND, error: &windows::core::Error) -> String {
        self.elements
            .retain(|_, cached| cached.dialog_window != dialog_window);
        let _ = error;
        STALE_REFERENCE_ERROR.to_string()
    }

    fn purge_expired(&mut self) {
        let now = Instant::now();
        self.elements.retain(|_, cached| cached.expires_at > now);
    }
}

fn supported_actions(
    element: &IUIAutomationElement,
    control_type: i32,
    automation_id: &str,
) -> Vec<NativeDialogAction> {
    let mut actions = Vec::with_capacity(4);
    if unsafe { element.GetCurrentPatternAs::<IUIAutomationInvokePattern>(UIA_InvokePatternId) }
        .is_ok()
    {
        actions.push(NativeDialogAction::Invoke);
    }
    if matches!(
        control_type,
        value if value == UIA_EditControlTypeId.0 || value == UIA_ComboBoxControlTypeId.0
    ) {
        if let Ok(pattern) =
            unsafe { element.GetCurrentPatternAs::<IUIAutomationValuePattern>(UIA_ValuePatternId) }
        {
            let read_only = unsafe { pattern.CurrentIsReadOnly() }
                .map(|value| value.as_bool())
                .unwrap_or(true);
            if !read_only {
                actions.push(NativeDialogAction::SetValue);
                if control_type == UIA_EditControlTypeId.0
                    && is_file_name_automation_id(automation_id)
                {
                    actions.push(NativeDialogAction::SetPaths);
                }
            }
        }
    }
    if unsafe {
        element.GetCurrentPatternAs::<IUIAutomationSelectionItemPattern>(UIA_SelectionItemPatternId)
    }
    .is_ok()
    {
        actions.push(NativeDialogAction::Select);
    }
    actions
}

fn infer_dialog_kind(controls: &[NativeDialogControl]) -> &'static str {
    if controls.iter().any(|control| {
        matches!(control.control_type.as_str(), "edit" | "combobox")
            && control
                .supported_actions
                .contains(&NativeDialogAction::SetValue)
    }) {
        "file"
    } else if controls
        .iter()
        .any(|control| control.control_type == "button")
    {
        "message"
    } else {
        "unknown"
    }
}

fn infer_semantic_role(
    control_type: i32,
    automation_id: &str,
    actions: &[NativeDialogAction],
) -> Option<String> {
    if actions == [NativeDialogAction::Invoke]
        && automation_id == "1"
        && !is_file_system_item_control_type(control_type)
    {
        return Some("accept".to_string());
    }
    if actions == [NativeDialogAction::Invoke]
        && automation_id == "2"
        && !is_file_system_item_control_type(control_type)
    {
        return Some("cancel".to_string());
    }
    let navigation_role = match automation_id {
        "NavigationButton" => Some("navigationMenu"),
        "40960" => Some("back"),
        "40961" => Some("forward"),
        "40962" | "40966" => Some("up"),
        "41477" | "Breadcrumb Parent" => Some("addressBar"),
        "SearchBox" => Some("search"),
        "NamespaceTreeControl" | "TreeView" => Some("navigationTree"),
        _ => None,
    };
    if let Some(role) = navigation_role {
        return Some(role.to_string());
    }

    if control_type == UIA_ButtonControlTypeId.0 {
        if automation_id == "CommandButton_1" {
            return Some("primary".to_string());
        }
        if automation_id == "CommandButton_2" {
            return Some("secondary".to_string());
        }
        let numeric_id = automation_id
            .strip_prefix("Button")
            .unwrap_or(automation_id)
            .parse::<u32>()
            .ok();
        let role = match numeric_id {
            Some(1) => "accept",
            Some(2) => "cancel",
            Some(3) => "abort",
            Some(4) => "retry",
            Some(5) => "ignore",
            Some(6) => "yes",
            Some(7) => "no",
            Some(8) => "close",
            Some(9) => "help",
            Some(10) => "tryAgain",
            Some(11) => "continue",
            _ => "button",
        };
        return Some(role.to_string());
    }

    if actions.contains(&NativeDialogAction::SetValue) {
        let is_file_name_control = is_file_name_automation_id(automation_id);
        let role = if is_file_name_control && control_type == UIA_EditControlTypeId.0 {
            "fileName"
        } else if is_file_name_control {
            "fileNameHost"
        } else {
            "editable"
        };
        return Some(role.to_string());
    }

    if actions.contains(&NativeDialogAction::Select) {
        let role = if control_type == UIA_TreeItemControlTypeId.0 {
            "navigationTreeItem"
        } else if is_file_system_item_control_type(control_type) {
            "fileSystemEntry"
        } else {
            "selectable"
        };
        return Some(role.to_string());
    }

    if automation_id == "1001" {
        return Some("currentLocation".to_string());
    }

    None
}

fn is_file_name_automation_id(automation_id: &str) -> bool {
    matches!(
        automation_id,
        "1001" | "1148" | "1152" | "FileNameControlHost"
    )
}

fn is_file_system_item_control_type(control_type: i32) -> bool {
    matches!(
        control_type,
        value if value == UIA_ListItemControlTypeId.0 || value == UIA_DataItemControlTypeId.0
    )
}

fn is_supported_file_dialog_control(control: &NativeDialogControl) -> bool {
    control.element_ref.is_some()
        || matches!(
            control.semantic_role.as_deref(),
            Some(
                "currentLocation"
                    | "addressBar"
                    | "navigationTree"
                    | "fileSystemEntry"
                    | "navigationTreeItem"
            )
        )
}

fn control_type_name(control_type: i32) -> &'static str {
    match control_type {
        value if value == UIA_ButtonControlTypeId.0 => "button",
        value if value == UIA_CheckBoxControlTypeId.0 => "checkbox",
        value if value == UIA_ComboBoxControlTypeId.0 => "combobox",
        value if value == UIA_DataItemControlTypeId.0 => "dataItem",
        value if value == UIA_EditControlTypeId.0 => "edit",
        value if value == UIA_ListItemControlTypeId.0 => "listItem",
        value if value == UIA_PaneControlTypeId.0 => "pane",
        value if value == UIA_RadioButtonControlTypeId.0 => "radioButton",
        value if value == UIA_TextControlTypeId.0 => "text",
        value if value == UIA_TreeItemControlTypeId.0 => "treeItem",
        value if value == UIA_WindowControlTypeId.0 => "window",
        _ => "custom",
    }
}

fn bounded_bstr(result: windows::core::Result<BSTR>) -> String {
    let value = result.map(|value| value.to_string()).unwrap_or_default();
    value.chars().take(MAX_TEXT_CHARS).collect()
}

fn validate_absolute_path(value: &str) -> Result<(), String> {
    if value.contains(['\0', '"'])
        || value.chars().count() > MAX_PATH_CHARS
        || !Path::new(value).is_absolute()
    {
        return Err("setValue requires a complete absolute path".to_string());
    }
    Ok(())
}

fn format_multi_select_paths(paths: &[String]) -> Result<String, String> {
    if paths.is_empty() || paths.len() > MAX_MULTI_SELECT_PATHS {
        return Err("setPaths requires between 1 and 100 absolute file paths".to_string());
    }

    for path in paths {
        if validate_absolute_path(path).is_err() || !Path::new(path).is_file() {
            return Err("setPaths requires existing absolute file paths".to_string());
        }
    }

    let formatted = paths
        .iter()
        .map(|path| format!("\"{path}\""))
        .collect::<Vec<_>>()
        .join(" ");
    if formatted.chars().count() > MAX_PATH_CHARS {
        return Err("setPaths combined path data is too long".to_string());
    }
    Ok(formatted)
}

fn hresult_error(context: &str, error: &windows::core::Error) -> String {
    format!("{context} failed (HRESULT 0x{:08X})", error.code().0 as u32)
}

fn hwnd_from_usize(value: usize) -> HWND {
    HWND(value as *mut core::ffi::c_void)
}

fn hwnd_as_usize(value: HWND) -> usize {
    value.0 as usize
}

struct EnumContext {
    process_id: u32,
    owner_window: HWND,
    windows: Vec<OwnedDialogWindow>,
}

#[derive(Clone, Copy)]
struct OwnedDialogWindow {
    window: HWND,
    immediate_owner: Option<HWND>,
    owner_depth: usize,
}

unsafe extern "system" fn enum_dialog_window(hwnd: HWND, context: LPARAM) -> BOOL {
    let context = &mut *(context.0 as *mut EnumContext);
    if context.windows.len() >= MAX_ENUMERATED_DIALOGS
        || !IsWindowVisible(hwnd).as_bool()
        || hwnd == context.owner_window
    {
        return BOOL(1);
    }

    let mut process_id = 0;
    GetWindowThreadProcessId(hwnd, Some(&mut process_id));
    if process_id == context.process_id {
        if let Some((owner_depth, immediate_owner)) =
            owner_chain_depth(hwnd, context.owner_window, context.process_id)
        {
            context.windows.push(OwnedDialogWindow {
                window: hwnd,
                immediate_owner: Some(immediate_owner),
                owner_depth,
            });
        }
    }
    BOOL(1)
}

fn enumerate_owned_dialog_windows(
    owner_window: HWND,
    process_id: u32,
) -> Result<Vec<OwnedDialogWindow>, String> {
    let mut context = EnumContext {
        process_id,
        owner_window,
        windows: Vec::new(),
    };
    unsafe {
        EnumWindows(
            Some(enum_dialog_window),
            LPARAM((&mut context as *mut EnumContext) as isize),
        )
    }
    .map_err(|error| hresult_error("Native dialog window enumeration", &error))?;
    context.windows.sort_by(|left, right| {
        right
            .owner_depth
            .cmp(&left.owner_depth)
            .then_with(|| hwnd_as_usize(left.window).cmp(&hwnd_as_usize(right.window)))
    });
    Ok(context.windows)
}

fn is_owned_dialog_window(dialog_window: HWND, owner_window: HWND, process_id: u32) -> bool {
    if !unsafe { IsWindow(Some(dialog_window)) }.as_bool()
        || !unsafe { IsWindowVisible(dialog_window) }.as_bool()
    {
        return false;
    }

    let mut actual_process_id = 0;
    unsafe { GetWindowThreadProcessId(dialog_window, Some(&mut actual_process_id)) };
    if actual_process_id != process_id {
        return false;
    }

    owner_chain_depth(dialog_window, owner_window, process_id).is_some()
}

fn owner_chain_depth(
    dialog_window: HWND,
    root_owner: HWND,
    expected_process_id: u32,
) -> Option<(usize, HWND)> {
    let mut current = dialog_window;
    let mut immediate_owner = None;
    let mut visited = HashSet::with_capacity(MAX_OWNER_CHAIN_DEPTH + 1);
    visited.insert(hwnd_as_usize(dialog_window));

    for depth in 1..=MAX_OWNER_CHAIN_DEPTH {
        let owner = unsafe { GetWindow(current, GW_OWNER) }.ok()?;
        if owner.0.is_null() || !visited.insert(hwnd_as_usize(owner)) {
            return None;
        }
        immediate_owner.get_or_insert(owner);

        let mut owner_process_id = 0;
        unsafe { GetWindowThreadProcessId(owner, Some(&mut owner_process_id)) };
        if owner_process_id != expected_process_id {
            return None;
        }
        if owner == root_owner {
            return immediate_owner.map(|immediate| (depth, immediate));
        }
        current = owner;
    }
    None
}

fn is_within_security_boundary(
    actual_process_id: u32,
    expected_process_id: u32,
    actual_owner: HWND,
    expected_owner: HWND,
) -> bool {
    actual_process_id == expected_process_id && actual_owner == expected_owner
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn security_boundary_rejects_other_processes_and_owners() {
        let expected_owner = hwnd_from_usize(100);
        assert!(is_within_security_boundary(
            42,
            42,
            expected_owner,
            expected_owner
        ));
        assert!(!is_within_security_boundary(
            7,
            42,
            expected_owner,
            expected_owner
        ));
        assert!(!is_within_security_boundary(
            42,
            42,
            hwnd_from_usize(101),
            expected_owner
        ));
    }

    #[test]
    fn semantic_roles_do_not_depend_on_localized_button_names() {
        assert_eq!(
            infer_semantic_role(
                UIA_ButtonControlTypeId.0,
                "6",
                &[NativeDialogAction::Invoke]
            ),
            Some("yes".to_string())
        );
        assert_eq!(
            infer_semantic_role(
                UIA_ButtonControlTypeId.0,
                "CommandButton_2",
                &[NativeDialogAction::Invoke]
            ),
            Some("secondary".to_string())
        );
        assert_eq!(
            infer_semantic_role(12345, "1", &[NativeDialogAction::Invoke]),
            Some("accept".to_string())
        );
    }

    #[test]
    fn relative_paths_fail_without_echoing_sensitive_values() {
        let sensitive_value = "private-file.txt";
        let error = validate_absolute_path(sensitive_value).unwrap_err();
        assert!(!error.contains(sensitive_value));
        assert!(error.contains("absolute path"));
    }

    #[test]
    fn multi_select_paths_are_quoted_without_echoing_invalid_values() {
        let fixture_directory =
            std::env::temp_dir().join(format!("tauri-mcp-path-test-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&fixture_directory).unwrap();
        let first = fixture_directory.join("first.txt");
        let second = fixture_directory.join("second file.txt");
        std::fs::write(&first, b"first").unwrap();
        std::fs::write(&second, b"second").unwrap();

        let paths = vec![
            first.to_string_lossy().into_owned(),
            second.to_string_lossy().into_owned(),
        ];
        let formatted = format_multi_select_paths(&paths).unwrap();
        assert_eq!(formatted, format!("\"{}\" \"{}\"", paths[0], paths[1]));

        let sensitive_value = fixture_directory.join("missing.txt");
        let sensitive_text = sensitive_value.to_string_lossy().into_owned();
        let error = format_multi_select_paths(std::slice::from_ref(&sensitive_text)).unwrap_err();
        assert!(!error.contains(sensitive_text.as_str()));

        std::fs::remove_dir_all(fixture_directory).unwrap();
    }

    #[test]
    fn navigation_roles_use_stable_automation_ids() {
        assert_eq!(
            infer_semantic_role(
                UIA_ButtonControlTypeId.0,
                "40960",
                &[NativeDialogAction::Invoke]
            ),
            Some("back".to_string())
        );
        assert_eq!(
            infer_semantic_role(UIA_PaneControlTypeId.0, "41477", &[]),
            Some("addressBar".to_string())
        );
        assert_eq!(
            infer_semantic_role(
                UIA_ListItemControlTypeId.0,
                "unlocalized-item-id",
                &[NativeDialogAction::Select]
            ),
            Some("fileSystemEntry".to_string())
        );
    }
}

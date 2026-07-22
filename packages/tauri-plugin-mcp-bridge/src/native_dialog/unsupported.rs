use super::{
    InteractRequest, NativeDialogInteractionResult, NativeDialogSnapshot, SnapshotRequest,
};

const UNSUPPORTED: &str =
    "Native dialog automation is only supported on Windows with an interactive desktop";

/// Non-Windows implementation that preserves cross-platform compilation and errors clearly.
#[derive(Clone, Default)]
pub struct NativeDialogAutomation;

impl NativeDialogAutomation {
    pub fn new() -> Self {
        Self
    }

    pub fn snapshot(&self, _request: SnapshotRequest) -> Result<NativeDialogSnapshot, String> {
        Err(UNSUPPORTED.to_string())
    }

    pub fn interact(
        &self,
        _request: InteractRequest,
    ) -> Result<NativeDialogInteractionResult, String> {
        Err(UNSUPPORTED.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native_dialog::{NativeDialogAction, SnapshotRequest};
    use std::time::Duration;

    #[test]
    fn unsupported_platform_fails_clearly() {
        let automation = NativeDialogAutomation::new();
        let error = automation
            .snapshot(SnapshotRequest {
                process_id: 1,
                owner_window: 0,
                scope_id: "test".to_string(),
                min_owner_depth: 1,
                timeout: Duration::from_millis(100),
            })
            .unwrap_err();

        assert!(error.contains("only supported on Windows"));

        let error = automation
            .interact(InteractRequest {
                process_id: 1,
                owner_window: 0,
                scope_id: "test".to_string(),
                element_ref: "missing".to_string(),
                action: NativeDialogAction::Invoke,
                value: None,
                paths: None,
                timeout: Duration::from_millis(100),
            })
            .unwrap_err();

        assert!(error.contains("interactive desktop"));
    }
}

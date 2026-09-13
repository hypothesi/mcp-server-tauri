//! IPC monitoring and event capture.
//!
//! This module provides functionality to monitor and capture Tauri IPC events,
//! including command invocations, arguments, results, and timing information.

use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};

/// Cap on captured IPC events. Oldest events are dropped when full.
///
/// Architecture specified `max_events` but the store was previously unbounded.
pub const DEFAULT_MAX_EVENTS: usize = 1000;

/// Represents a captured IPC event.
///
/// Each event records a Tauri command invocation with its arguments, result,
/// any errors, and execution timing. Events are captured when IPC monitoring
/// is enabled.
///
/// # Fields
///
/// * `timestamp` - Unix timestamp in milliseconds when the event occurred
/// * `command` - Name of the Tauri command that was invoked
/// * `args` - JSON arguments passed to the command
/// * `result` - Optional JSON result returned by the command
/// * `error` - Optional error message if the command failed
/// * `duration_ms` - Optional execution duration in milliseconds
///
/// # Examples
///
/// ```rust
/// use tauri_plugin_mcp_bridge::monitor::IPCEvent;
/// use serde_json::json;
///
/// let event = IPCEvent {
///     timestamp: 1234567890,
///     command: "greet".to_string(),
///     args: json!({"name": "World"}),
///     result: Some(json!({"message": "Hello, World!"})),
///     error: None,
///     duration_ms: Some(5.2),
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IPCEvent {
    pub timestamp: u64,
    pub command: String,
    pub args: serde_json::Value,
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
    pub duration_ms: Option<f64>,
}

/// IPC monitor for capturing Tauri command invocations.
///
/// The monitor can be enabled or disabled and maintains a list of captured
/// events. When enabled, it records all IPC events that occur. Events are
/// cleared when monitoring is restarted.
///
/// # Thread Safety
///
/// This struct is typically wrapped in `Arc<Mutex<IPCMonitor>>` to allow
/// safe concurrent access from multiple threads.
///
/// # Examples
///
/// ```rust
/// use tauri_plugin_mcp_bridge::monitor::IPCMonitor;
///
/// let mut monitor = IPCMonitor::new();
/// monitor.start();
/// // ... capture events ...
/// monitor.stop();
/// let events = monitor.get_events();
/// ```
pub struct IPCMonitor {
    pub enabled: bool,
    pub events: Vec<IPCEvent>,
    max_events: usize,
}

impl Default for IPCMonitor {
    fn default() -> Self {
        Self::new()
    }
}

impl IPCMonitor {
    /// Creates a new IPC monitor in the disabled state.
    ///
    /// # Returns
    ///
    /// A new `IPCMonitor` with monitoring disabled and an empty event list.
    ///
    /// # Examples
    ///
    /// ```rust
    /// use tauri_plugin_mcp_bridge::monitor::IPCMonitor;
    ///
    /// let monitor = IPCMonitor::new();
    /// assert!(!monitor.enabled);
    /// ```
    pub fn new() -> Self {
        Self::with_max_events(DEFAULT_MAX_EVENTS)
    }

    /// Creates a monitor that stores at most `max_events` entries.
    pub fn with_max_events(max_events: usize) -> Self {
        Self {
            enabled: false,
            events: Vec::new(),
            max_events,
        }
    }

    /// Starts IPC monitoring and clears previous events.
    ///
    /// Enables the monitor and clears any previously captured events.
    /// After calling this method, all subsequent IPC calls will be captured.
    ///
    /// # Examples
    ///
    /// ```rust
    /// use tauri_plugin_mcp_bridge::monitor::IPCMonitor;
    ///
    /// let mut monitor = IPCMonitor::new();
    /// monitor.start();
    /// assert!(monitor.enabled);
    /// ```
    pub fn start(&mut self) {
        self.enabled = true;
        self.events.clear();
    }

    /// Stops IPC monitoring.
    ///
    /// Disables the monitor, preventing new events from being captured.
    /// Previously captured events remain available.
    ///
    /// # Examples
    ///
    /// ```rust
    /// use tauri_plugin_mcp_bridge::monitor::IPCMonitor;
    ///
    /// let mut monitor = IPCMonitor::new();
    /// monitor.start();
    /// monitor.stop();
    /// assert!(!monitor.enabled);
    /// ```
    pub fn stop(&mut self) {
        self.enabled = false;
    }

    /// Adds an IPC event to the monitor if monitoring is enabled.
    ///
    /// Events are only added when the monitor is enabled. If disabled,
    /// the event is silently ignored. When the store is at `max_events`,
    /// the oldest event is dropped (ring buffer).
    ///
    /// # Arguments
    ///
    /// * `event` - The IPC event to add
    ///
    /// # Examples
    ///
    /// ```rust
    /// use tauri_plugin_mcp_bridge::monitor::{IPCMonitor, IPCEvent};
    /// use serde_json::json;
    ///
    /// let mut monitor = IPCMonitor::new();
    /// monitor.start();
    ///
    /// let event = IPCEvent {
    ///     timestamp: 1234567890,
    ///     command: "test".to_string(),
    ///     args: json!({}),
    ///     result: None,
    ///     error: None,
    ///     duration_ms: None,
    /// };
    ///
    /// monitor.add_event(event);
    /// assert_eq!(monitor.get_events().len(), 1);
    /// ```
    pub fn add_event(&mut self, event: IPCEvent) {
        if !self.enabled {
            return;
        }
        if self.max_events == 0 {
            self.events.clear();
            return;
        }
        while self.events.len() >= self.max_events {
            self.events.remove(0);
        }
        self.events.push(event);
    }

    /// Returns a copy of all captured events.
    ///
    /// # Returns
    ///
    /// A vector containing clones of all captured IPC events.
    ///
    /// # Examples
    ///
    /// ```rust
    /// use tauri_plugin_mcp_bridge::monitor::IPCMonitor;
    ///
    /// let monitor = IPCMonitor::new();
    /// let events = monitor.get_events();
    /// assert_eq!(events.len(), 0);
    /// ```
    pub fn get_events(&self) -> Vec<IPCEvent> {
        self.events.clone()
    }
}

/// Type alias for thread-safe IPC monitor state.
///
/// This type wraps `IPCMonitor` in an `Arc<Mutex<>>` to allow safe
/// concurrent access from multiple threads. It's used as Tauri managed
/// state to share the monitor across command handlers.
pub type IPCMonitorState = Arc<Mutex<IPCMonitor>>;

/// Returns the current Unix timestamp in milliseconds.
///
/// # Returns
///
/// The number of milliseconds since the Unix epoch (January 1, 1970).
///
/// # Examples
///
/// ```rust
/// use tauri_plugin_mcp_bridge::monitor::current_timestamp;
///
/// let timestamp = current_timestamp();
/// assert!(timestamp > 0);
/// ```
pub fn current_timestamp() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn event(command: impl Into<String>) -> IPCEvent {
        IPCEvent {
            timestamp: 1,
            command: command.into(),
            args: json!({}),
            result: None,
            error: None,
            duration_ms: None,
        }
    }

    #[test]
    fn add_event_never_grows_past_cap() {
        const CAP: usize = 8;
        let mut monitor = IPCMonitor::with_max_events(CAP);
        monitor.start();

        for i in 0..(CAP * 3) {
            monitor.add_event(event(i.to_string()));
            assert!(
                monitor.events.len() <= CAP,
                "events grew to {} past cap {CAP}",
                monitor.events.len()
            );
        }

        assert_eq!(monitor.events.len(), CAP);
        let commands: Vec<_> = monitor
            .get_events()
            .into_iter()
            .map(|e| e.command)
            .collect();
        let expected: Vec<_> = ((CAP * 2)..(CAP * 3)).map(|i| i.to_string()).collect();
        assert_eq!(commands, expected);
    }

    #[test]
    fn new_monitor_uses_documented_cap() {
        assert_eq!(IPCMonitor::new().max_events, DEFAULT_MAX_EVENTS);
        assert_eq!(DEFAULT_MAX_EVENTS, 1000);
    }

    #[test]
    fn disabled_monitor_does_not_store_events() {
        let mut monitor = IPCMonitor::with_max_events(2);
        monitor.add_event(event("ignored"));
        assert!(monitor.events.is_empty());
    }

    #[test]
    fn start_clears_previous_events() {
        let mut monitor = IPCMonitor::with_max_events(4);
        monitor.start();
        monitor.add_event(event("old"));
        monitor.start();
        assert!(monitor.events.is_empty());
        assert!(monitor.enabled);
    }

    #[test]
    fn zero_cap_stores_nothing() {
        let mut monitor = IPCMonitor::with_max_events(0);
        monitor.start();
        monitor.add_event(event("dropped"));
        assert!(monitor.events.is_empty());
    }
}

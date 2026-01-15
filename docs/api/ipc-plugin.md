---
title: IPC & Plugin Tools
description: Access Tauri IPC layer directly - execute commands, monitor IPC events, emit custom events, and inspect backend state and window information.
head:
  - - meta
    - name: keywords
      content: tauri ipc, plugin bridge, event monitoring, backend state, window management
---

# IPC & Plugin Tools

Access Tauri's Inter-Process Communication (IPC) layer directly through the MCP Bridge plugin. These tools provide deep integration with your Tauri backend, window management, and event system.

## ipc_execute_command

Execute any Tauri IPC command directly.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `command` | string | Yes | IPC command name to execute |
| `args` | any | No | Command arguments |

### Example

```javascript
// Call a custom Tauri command
{
  "tool": "ipc_execute_command",
  "command": "greet",
  "args": {
    "name": "World"
  }
}
```

### Response

Returns the result of the IPC command execution.

## ipc_monitor

Start or stop IPC event monitoring for debugging and analysis.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `action` | string | Yes | Action: 'start' or 'stop' |

### Example

```javascript
// Start monitoring IPC events
{
  "tool": "ipc_monitor",
  "action": "start"
}

// Stop monitoring
{
  "tool": "ipc_monitor",
  "action": "stop"
}
```

## ipc_get_captured

Retrieve captured IPC traffic (commands and events) from the monitor.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `filter` | string | No | Filter events by command name |

### Example

```javascript
// Get all captured IPC traffic
{
  "tool": "ipc_get_captured"
}

// Get traffic matching a filter
{
  "tool": "ipc_get_captured",
  "filter": "greet"
}
```

### Response

Returns an array of captured IPC traffic with timestamps, command/event names, arguments, and responses.

## ipc_emit_event

Emit custom events to the Tauri event system for testing event handlers.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `eventName` | string | Yes | Event name to emit |
| `payload` | any | No | Event payload data |

### Example

```javascript
// Emit a custom event
{
  "tool": "ipc_emit_event",
  "eventName": "user-action",
  "payload": {
    "action": "button-clicked"
  }
}
```

## ipc_get_backend_state

Get comprehensive backend application state and metadata.

### Parameters

None.

### Example

```javascript
{
  "tool": "ipc_get_backend_state"
}
```

### Response

Returns detailed backend state:

```json
{
  "app": {
    "name": "My Tauri App",
    "identifier": "com.example.myapp",
    "version": "1.0.0"
  },
  "tauri": {
    "version": "2.9.3"
  },
  "environment": {
    "debug": true,
    "os": "macos",
    "arch": "aarch64",
    "family": "unix"
  },
  "windows": [
    {
      "label": "main",
      "title": "My App",
      "focused": true,
      "visible": true
    }
  ],
  "window_count": 1,
  "timestamp": 1732654123456
}
```

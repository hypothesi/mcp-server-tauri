---
title: UI Automation Tools
description: Automate Tauri application UI testing - manage sessions, capture screenshots, access console logs, and control webview interactions.
head:
  - - meta
    - name: keywords
      content: tauri ui testing, automation, screenshots, console logs, webview automation
---

# UI Automation

Control and automate your Tauri application's UI. These tools provide comprehensive automation capabilities for testing and interaction, working seamlessly across all platforms (Linux, Windows, macOS).

## Multi-Window Support

All webview tools support targeting specific windows in multi-window applications. Use the optional `windowId` parameter to specify which window to interact with. If not specified, tools default to the "main" window.

### Discovering Windows

Use `manage_window` with `action: "list"` to discover all available windows:

```javascript
{
  "tool": "manage_window",
  "action": "list"
}
```

**Response:**

```json
{
  "windows": [
    {
      "label": "main",
      "title": "My App",
      "url": "http://localhost:1420/",
      "focused": true,
      "visible": true,
      "isMain": true
    },
    {
      "label": "settings",
      "title": "Settings",
      "url": "http://localhost:1420/settings",
      "focused": false,
      "visible": true,
      "isMain": false
    }
  ],
  "defaultWindow": "main",
  "totalCount": 2
}
```

### Getting Window Info

Use `action: "info"` to get detailed information about a specific window:

```javascript
{
  "tool": "manage_window",
  "action": "info",
  "windowId": "main"
}
```

**Response:**

```json
{
  "width": 800,
  "height": 600,
  "x": 100,
  "y": 100,
  "title": "My App",
  "focused": true,
  "visible": true
}
```

### Resizing Windows

Use `action: "resize"` to resize a window to specific dimensions:

```javascript
{
  "tool": "manage_window",
  "action": "resize",
  "width": 1024,
  "height": 768
}
```

**Response:**

```json
{
  "success": true,
  "windowLabel": "main",
  "width": 1024,
  "height": 768,
  "logical": true
}
```

By default, dimensions are in logical pixels (respects display scaling). Set `logical: false` for physical pixels. The resize will fail if the window has fixed size constraints or is not resizable.

### Targeting a Specific Window

Add `windowId` to any webview tool to target a specific window:

```javascript
// Execute JavaScript in the settings window
{
  "tool": "webview_execute_js",
  "script": "document.title",
  "windowId": "settings"
}

// Take a screenshot of the main window (explicit)
{
  "tool": "webview_screenshot",
  "windowId": "main"
}
```

## driver_session

Manage UI automation session lifecycle. Initializes console log capture and prepares the webview for automation. Supports remote device connections via the `host` parameter.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `action` | string | Yes | Action to perform: 'start', 'stop', or 'status' |
| `host` | string | No | Host address to connect to (e.g., '192.168.1.100'). Falls back to `MCP_BRIDGE_HOST` or `TAURI_DEV_HOST` env vars |
| `port` | number | No | Port to connect to (default: 9223) |

### Actions

- **`start`** - Start a new session, connecting to the Tauri app
- **`stop`** - Stop the current session and disconnect
- **`status`** - Check current connection status without changing state. Returns the app's `identifier` (bundle ID) which can be used to determine if the session is connected to the correct app

### Connection Strategy

When starting a session, the tool uses the following connection strategy:

1. **Try localhost first** - Most reliable for simulators, emulators, and desktop apps
2. **Fall back to configured host** - If localhost fails and a remote host is configured
3. **Auto-discover** - Scan port range on localhost for running apps
4. **Graceful fallback** - Return success message even if no app found (allows IPC-only mode)

### Example

```javascript
// Start an automation session (default - localhost)
{
  "tool": "tauri_driver_session",
  "action": "start"
}

// Connect to a real iOS device on the network
{
  "tool": "tauri_driver_session",
  "action": "start",
  "host": "192.168.1.100"
}

// Connect to a specific port
{
  "tool": "tauri_driver_session",
  "action": "start",
  "port": 9225
}

// Check connection status
{
  "tool": "tauri_driver_session",
  "action": "status"
}
```

### Response

**Start/Stop:**
```
Session started with app: My App (localhost:9223)
```

**Status:**
```json
{
  "connected": true,
  "app": "My App",
  "identifier": "com.example.my-app",
  "host": "localhost",
  "port": 9223
}
```

The `identifier` field contains the app's bundle ID (e.g., `com.example.my-app`). Use this to verify you're connected to the correct application before reusing an existing session.

> **Note:** The `identifier` field may be `null` if the Tauri app uses an older version of the MCP Bridge plugin that doesn't provide app identification. In this case, you cannot verify the app identity and should start a new session if uncertain.

### Environment Variables

- **`MCP_BRIDGE_HOST`** - Default host when `host` parameter not provided
- **`TAURI_DEV_HOST`** - Fallback host (same as Tauri CLI uses for mobile dev)
- **`MCP_BRIDGE_PORT`** - Default port when `port` parameter not provided

### Remote Device Setup

For real iOS/Android devices on the network:

1. Ensure your development machine and device are on the same network
2. The Tauri plugin binds to `0.0.0.0` by default, allowing remote connections
3. Use the device's IP address as the `host` parameter

**Android alternative**: Use `adb reverse tcp:9223 tcp:9223` to forward the port, then connect to localhost.

**Note**: No external driver process required.

## webview_find_element

Find UI elements using CSS, XPath, or text selectors.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `selector` | string | Yes | Element selector |
| `strategy` | string | No | Selector strategy: 'css', 'xpath', 'text' (default: 'css') |
| `windowId` | string | No | Window label to target (defaults to 'main') |

### Example

```javascript
// Find a button by CSS selector
{
  "tool": "webview_find_element",
  "selector": "#submit-button",
  "strategy": "css"
}

// Find by text content
{
  "tool": "webview_find_element",
  "selector": "Submit",
  "strategy": "text"
}
```

### Response

Returns element information including tag name, text content, and attributes.

## read_logs

Read logs from various sources: webview console logs, Android logcat, iOS simulator logs, or desktop system logs.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `source` | string | Yes | Log source: 'console', 'android', 'ios', 'system' |
| `lines` | number | No | Number of log lines to retrieve (default: 50) |
| `filter` | string | No | Regex or keyword to filter logs |
| `since` | string | No | ISO timestamp to filter logs since |
| `windowId` | string | No | Window label for console logs (defaults to 'main') |

### Sources

- **`console`** - JavaScript console logs from the webview (requires active session)
- **`android`** - Android logcat output
- **`ios`** - iOS simulator logs
- **`system`** - Desktop system logs (macOS/Linux)

### Example

```javascript
// Get webview console logs
{
  "tool": "read_logs",
  "source": "console"
}

// Get console logs matching a pattern
{
  "tool": "read_logs",
  "source": "console",
  "filter": "error|warning"
}

// Read Android logcat
{
  "tool": "read_logs",
  "source": "android",
  "filter": "com.myapp",
  "lines": 100
}

// Read system logs
{
  "tool": "read_logs",
  "source": "system",
  "lines": 50
}
```

### Response

Returns log entries from the specified source with timestamps and log levels.

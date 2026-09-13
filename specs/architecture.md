# MCP Server Tauri Architecture

## Overview

This system provides a Model Context Protocol (MCP) server that bridges AI assistants with Tauri applications. It enables AI agents to interact with Tauri webviews, execute JavaScript, monitor IPC events, and control application behavior through a WebSocket-based protocol.

## Core Components

### 1. MCP Server (`packages/mcp-server`)
Node.js/TypeScript server that implements the MCP protocol and provides tools for interacting with Tauri applications.

**Key Modules:**
- **`driver/`** - Native interface for controlling Tauri apps
  - `session-manager.ts` - Manages driver lifecycle
  - `plugin-client.ts` - WebSocket client for communicating with Tauri plugin
  - `webview-executor.ts` - Executes JavaScript in webviews
  - `webview-interactions.ts` - High-level interaction APIs (click, type, etc.)
  - `script-manager.ts` - Internal API for persistent script injection
- **`tools-registry.ts`** - Central registry of all MCP tools
- **`index.ts`** - MCP server entry point

### 2. Tauri Plugin (`packages/tauri-plugin-mcp-bridge`)
Rust plugin that runs inside Tauri applications, providing the bridge between MCP commands and the app.

**Key Modules:**
- **`lib.rs`** - Plugin initialization and setup
- **`commands/`** - Tauri command handlers
- **`websocket.rs`** - WebSocket server for MCP communication
- **`monitor.rs`** - IPC event monitoring
- **`script_registry.rs`** - Persistent script injection registry
- **`bridge.js`** - JavaScript initialization code

### 3. Test Application (`packages/test-app`)
Sample Tauri application for testing and development.

## Communication Flow

```
AI Assistant
     ↓
MCP Protocol (stdio)
     ↓
MCP Server (Node.js)
     ↓
WebSocket (port 9223)
     ↓
Tauri Plugin (Rust)
     ↓
Webview (JavaScript)
```

## JavaScript Execution Architecture

The JavaScript execution mechanism uses a hybrid event/channel pattern:

### Execution Flow:
1. **Request arrives** via WebSocket to execute JavaScript
2. **Unique ID generated** using UUID v4
3. **Oneshot channel created** for awaiting result
4. **Event listener registered** for `__script_result` events
5. **Script wrapped** in async IIFE with error handling
6. **Script evaluated** using `window.eval()`
7. **Result emitted** from JavaScript via `window.__TAURI__.event.emit()`
8. **Event captured** by Rust listener
9. **Result forwarded** through oneshot channel
10. **Response sent** back through WebSocket

### Key Design Decisions:
- **Events over invoke**: JavaScript uses event emission because `invoke` doesn't work from eval context
- **Oneshot channels**: Clean async pattern for awaiting results without polling
- **Smart script detection**: Automatically adds `return` for expressions
- **Timeout handling**: 5-second timeout with proper cleanup
- **State management**: `ScriptExecutor` manages pending results

## Script Registry

The plugin maintains a registry of scripts that should be automatically re-injected when pages load or navigate. This is used internally for persistent library loading (e.g., html2canvas for screenshots).

### Architecture:
```rust
pub struct ScriptRegistry {
    scripts: HashMap<String, ScriptEntry>,
}

pub struct ScriptEntry {
    id: String,
    script_type: ScriptType, // Inline or Url
    content: String,
}
```

### WebSocket Commands:
- `register_script` - Add a script to the registry and inject it
- `remove_script` - Remove a script from registry and DOM
- `clear_scripts` - Clear all registered scripts
- `get_scripts` - List all registered scripts

### Page Load Re-injection:
When a page loads, `bridge.js` calls `request_script_injection` to re-inject all registered scripts. This ensures libraries like html2canvas persist across navigations.

## IPC Monitoring

The plugin can monitor all Tauri IPC events for debugging and introspection:

```rust
pub struct IPCMonitor {
    events: Vec<IPCEvent>,
    is_monitoring: bool,
    max_events: usize, // default 1000
}
```

Events are captured and stored with timestamps, allowing AI agents to understand application behavior. `add_event` enforces `max_events` as a ring buffer (drop oldest); the store never grows past the cap.

## WebSocket Protocol

Commands are JSON-RPC style messages:

```json
{
  "command": "execute_js",
  "args": {
    "script": "document.title"
  },
  "id": "unique-request-id"
}
```

Responses include success/error status:

```json
{
  "id": "unique-request-id",
  "success": true,
  "data": "Page Title"
}
```

## Testing Architecture

- **Unit tests**: Test individual components
- **E2E tests**: Full integration tests using the test app
- **Global setup**: Single app instance for all tests (performance optimization)
- **Vitest**: Test runner with TypeScript support

## Key Dependencies

### MCP Server
- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `vitest` - Testing framework
- `typescript` - Type safety

### Tauri Plugin
- `tauri` v2.9+ - Application framework
- `tokio` - Async runtime
- `tokio-tungstenite` - WebSocket server
- `serde_json` - JSON serialization
- `uuid` - Unique ID generation

## Configuration

### Environment Variables
- `TAURI_PLUGIN_LOG_LEVEL` - Plugin logging level
- `MCP_SERVER_PORT` - WebSocket server port (default: 9223)

### Plugin Initialization
```rust
let mut builder = tauri::Builder::default();

#[cfg(debug_assertions)]
{
    builder = builder.plugin(tauri_plugin_mcp_bridge::init());
}

builder.run(tauri::generate_context!())
```

## Common Patterns for LLM Agents

### 1. Execute JavaScript in Webview
```typescript
const result = await executeInWebview('document.querySelector("button").click()');
```

### 2. Monitor IPC Events
```typescript
await driver.send({ command: 'start_ipc_monitor' });
// ... perform actions ...
const events = await driver.send({ command: 'get_ipc_events' });
```

### 3. Interact with Elements
```typescript
await clickElement({ selector: '#submit-button' });
await typeText({ selector: 'input[type="text"]', text: 'Hello' });
```

## Troubleshooting Guide

### Common Issues:

1. **Script timeout**: Check if JavaScript is async and needs await
2. **WebSocket connection failed**: Ensure plugin is initialized
3. **Element not found**: Verify selector and page state
4. **IPC events not captured**: Check monitoring is started

### Debug Commands:
- Get window info: `{ command: "get_window_info" }`
- Check backend state: `{ command: "get_backend_state" }`
- View IPC events: `{ command: "get_ipc_events" }`

## Future Improvements

- [ ] Implement Chrome DevTools Protocol integration
- [x] Support multiple windows/webviews
- [ ] Enhanced error recovery
- [ ] Performance metrics collection

## Notes for AI Agents

1. **Always check if app is running** before sending commands
2. **Use smart retries** for transient failures
3. **Monitor IPC events** to understand app state changes
4. **Prefer specific selectors** over generic ones
5. **Handle async operations** with appropriate timeouts
6. **Clean up resources** after test completion

## Architecture Principles

1. **Separation of Concerns**: Clear boundaries between MCP server, plugin, and app
2. **Async-First**: All operations are non-blocking
3. **Error Recovery**: Graceful handling of failures
4. **Observability**: Comprehensive logging and event monitoring
5. **Type Safety**: TypeScript and Rust for compile-time guarantees
6. **Performance**: Single app instance, efficient communication

---

*Last Updated: November 2025*
*Version: 0.1.0*

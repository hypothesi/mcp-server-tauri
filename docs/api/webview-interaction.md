---
title: WebView Interaction Tools
description: Interact with Tauri webview - perform gestures, keyboard input, take screenshots, execute JavaScript, find elements, and inspect CSS styles.
head:
  - - meta
    - name: keywords
      content: tauri webview, gestures, keyboard input, javascript execution, element finding, css inspection
---

# WebView Interaction Tools

Comprehensive tools for interacting with your Tauri application's webview, including gestures, keyboard input, screenshots, and JavaScript execution.

## webview_interact

Perform various interaction gestures on webview elements.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `action` | string | Yes | Action: 'click', 'double-click', 'long-press', 'scroll', 'swipe', 'focus' |
| `selector` | string | No | CSS selector for the element to interact with |
| `x` | number | No | X coordinate for direct coordinate interaction |
| `y` | number | No | Y coordinate for direct coordinate interaction |
| `duration` | number | No | Duration in ms (default: 500ms for long-press, 300ms for swipe) |
| `scrollX` | number | No | Horizontal scroll amount in pixels (positive = right) |
| `scrollY` | number | No | Vertical scroll amount in pixels (positive = down) |
| `fromX` | number | No | Starting X coordinate for swipe |
| `fromY` | number | No | Starting Y coordinate for swipe |
| `toX` | number | No | Ending X coordinate for swipe |
| `toY` | number | No | Ending Y coordinate for swipe |

### Example

```javascript
// Click an element by selector
{
  "tool": "webview_interact",
  "action": "click",
  "selector": "#submit-button"
}

// Long press at coordinates
{
  "tool": "webview_interact",
  "action": "long-press",
  "x": 100,
  "y": 200,
  "duration": 1000
}

// Scroll an element
{
  "tool": "webview_interact",
  "action": "scroll",
  "selector": ".content-area",
  "scrollY": 200
}

// Swipe gesture
{
  "tool": "webview_interact",
  "action": "swipe",
  "fromX": 200,
  "fromY": 100,
  "toX": 200,
  "toY": 400,
  "duration": 500
}

// Focus an element
{
  "tool": "webview_interact",
  "action": "focus",
  "selector": "#username-input"
}
```

## webview_screenshot

Capture a screenshot of the current viewport (visible area) of the webview.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `format` | string | No | Image format: 'png', 'jpeg' (default: 'png') |
| `quality` | number | No | JPEG quality 0-100 (only for jpeg format) |
| `filePath` | string | No | File path to save the screenshot to instead of returning base64 |
| `windowId` | string | No | Window label to target (defaults to 'main') |
| `maxWidth` | number | No | Maximum width in pixels. Images wider than this will be scaled down proportionally |

### Example

```javascript
// Take a PNG screenshot (returns base64)
{
  "tool": "webview_screenshot",
  "format": "png"
}

// Save screenshot to a file
{
  "tool": "webview_screenshot",
  "format": "png",
  "filePath": "/path/to/screenshot.png"
}

// Take a screenshot with max width constraint (useful for reducing token usage)
{
  "tool": "webview_screenshot",
  "maxWidth": 800
}
```

### Response

Returns a base64-encoded image, or if `filePath` is provided, returns the path where the screenshot was saved.

### Environment Variable

You can set a default `maxWidth` for all screenshots using the `TAURI_MCP_SCREENSHOT_MAX_WIDTH` environment variable. The tool parameter takes precedence over the environment variable.

```bash
# Set default max width to 800 pixels
export TAURI_MCP_SCREENSHOT_MAX_WIDTH=800
```

::: tip
This only captures what is currently visible. Scroll content into view before taking screenshots if you need to capture specific elements.
:::

## webview_keyboard

Type text or send keyboard events to the webview.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `action` | string | Yes | Action: 'type', 'press', 'down', 'up' |
| `selector` | string | No | CSS selector for element to type into (required for 'type' action) |
| `text` | string | No | Text to type (required for 'type' action) |
| `key` | string | No | Key to press (required for 'press/down/up' actions, e.g., 'Enter', 'Escape') |
| `modifiers` | string[] | No | Modifier keys: ['Control', 'Alt', 'Shift', 'Meta'] |

### Example

```javascript
// Type text into an input
{
  "tool": "webview_keyboard",
  "action": "type",
  "selector": "#username",
  "text": "Hello World"
}

// Send keyboard shortcut
{
  "tool": "webview_keyboard",
  "action": "press",
  "key": "s",
  "modifiers": ["Control"]
}
```

## webview_wait_for

Wait for specific conditions in the webview.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `type` | string | Yes | What to wait for: 'selector', 'text', 'ipc-event' |
| `value` | string | Yes | Selector, text content, or IPC event name to wait for |
| `timeout` | number | No | Timeout in milliseconds (default: 5000ms) |

### Example

```javascript
// Wait for element to appear
{
  "tool": "webview_wait_for",
  "type": "selector",
  "value": "#loading-complete",
  "timeout": 10000
}

// Wait for text to appear
{
  "tool": "webview_wait_for",
  "type": "text",
  "value": "Success!"
}
```

## webview_execute_js

Execute JavaScript code in the webview context.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `script` | string | Yes | JavaScript code to execute |
| `args` | array | No | Arguments to pass to the script |

### Script Format

Scripts can be any valid JavaScript. If you need a return value, it must be JSON-serializable:

- **Side effects only**: `console.log('hello')`, `document.body.classList.add('dark')`
- **Simple expressions**: `document.title`, `5 + 3`, `window.location.href`
- **Statements with return**: `const x = 5; return x * 2;`
- **Async operations**: `const res = await fetch('/api'); return await res.json();`
- **IIFE (Immediately Invoked Function Expression)**: `(() => { return 5; })()`

::: warning Returning Values from Functions
If you want to return a value from a function, use an IIFE: `(() => { return 5; })()` not `() => { return 5; }`. Bare function definitions are not JSON-serializable and will return `null`.
:::

### Example

```javascript
// Get page data (simple expression)
{
  "tool": "webview_execute_js",
  "script": "document.title + ' - ' + window.location.href"
}

// Async operation
{
  "tool": "webview_execute_js",
  "script": "const res = await fetch('/api/data'); return await res.json();"
}

// IIFE for complex logic
{
  "tool": "webview_execute_js",
  "script": "(() => { const items = document.querySelectorAll('li'); return items.length; })()"
}
```

### Response

Returns the result of the JavaScript execution as a JSON string. Non-serializable values (like functions or DOM elements) will return `null`.

## webview_get_styles

Get computed CSS styles for elements.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `selector` | string | Yes | CSS selector for element(s) to get styles from |
| `properties` | string[] | No | Specific CSS properties to retrieve (if omitted, returns all) |
| `multiple` | boolean | No | Get styles for all matching elements (default: false) |

### Example

```javascript
// Get specific styles
{
  "tool": "webview_get_styles",
  "selector": "#my-element",
  "properties": ["color", "background-color", "font-size"]
}
```

### Response

Returns a JSON string with the computed styles.

## Common Patterns

### Dismissing the Keyboard

To dismiss the on-screen keyboard, use `webview_execute_js`:

```javascript
{
  "tool": "webview_execute_js",
  "script": "document.activeElement?.blur()"
}
```

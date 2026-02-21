---
title: "Element Picker: Point, Click, Fix"
description: A hands-on guide to using the element picker to visually select UI elements in your Tauri app and work with them through your AI assistant.
head:
  - - meta
    - name: keywords
      content: tauri element picker, visual selection, ui debugging, point and click, webview element, css inspector
---

# Element Picker: Point, Click, Fix

## The Problem with Screenshots

The `webview_screenshot` tool is great for seeing the big picture — the AI can look at your whole page and spot obvious layout issues. But when you need to fix a *specific element*, a full-page screenshot falls short. The AI can't reliably tell that a button's font weight is `400` instead of `600`, or that there's `12px` of padding where there should be `16px`. And even if it could, it still wouldn't know the element's CSS selector, computed styles, or which component file to open.

The element picker closes that gap. You point at the element, and the AI gets everything: tag, classes, computed styles, bounding rect, parent chain, *and* a cropped screenshot of just that element. It's the difference between "look at this page" and "here's exactly what's wrong and where to fix it."

## Quick Start — Try It in 30 Seconds

::: tip Prerequisites
Your Tauri app needs the MCP bridge plugin installed and `withGlobalTauri` enabled. If you haven't set that up yet, follow the [Getting Started guide](/guides/getting-started) first.
:::

**Step 1.** Type a `/select` command with what you want to do:

```
/select this button should be green instead of blue
```

**Step 2.** A blue overlay appears in your app. Move your cursor to highlight elements, then click the one you mean.

**Step 3.** The AI receives the element's metadata and screenshot, then responds using that context.

**Example session:**

```
You: /select the font size on this heading looks too small

AI: I'll activate the element picker so you can show me which heading.

    [Blue overlay appears in your app]
    [You hover over the heading — it highlights with a blue outline]
    [You click it]

    I can see the heading you selected:
    - Element: <h2> with class "section-title"
    - Current font-size: 14px
    - CSS Selector: .content-area > h2.section-title

    That does look small for a section heading. I'll update the CSS
    to bump it to 20px...
```

::: info
That's all most people need. The sections below go deeper into the two picking modes, what metadata the AI receives, and real-world workflows.
:::

## Two Ways to Point

There are two conversation styles for selecting elements, depending on who initiates the pick.

### "Hey, show me" — Agent-Initiated

The AI activates a picker overlay and waits for you to click. This is what happens when you use `/select` or when the AI decides it needs you to point something out.

A translucent blue overlay covers your app. As you move your cursor, elements highlight with a blue outline and a tooltip shows their tag, ID, and dimensions. Click to select.

### "Look at this" — User-Initiated

You **Alt+Shift+Click** an element at any time while using your app — no need to ask the AI first. A green flash confirms the selection was captured. Later, come back to the AI and it can retrieve what you pointed at.

This is great for when you notice something while testing and want to flag it without breaking your flow.

| | Agent-Initiated | User-Initiated |
|---|---|---|
| **Who starts it** | AI activates the overlay | You Alt+Shift+Click |
| **Visual cue** | Blue overlay + highlight | Green flash (fades after 1.5s) |
| **Timing** | Synchronous — AI waits for your click | Asynchronous — pick now, discuss later |
| **Cancel** | Escape key or X button | N/A (it's instant) |
| **Best for** | AI asks you to point something out | You notice something while working |

::: tip
You don't need to remember which tool does what. Just describe what you want — "look at the element I pointed at" or "let me show you which button" — and the AI picks the right approach.
:::

## What the AI Sees

When you select an element, the AI receives a detailed metadata report plus a cropped screenshot. Here's what a typical report looks like:

```
Element: <button>
ID: submit-btn
Classes: btn btn-primary lg
CSS Selector: .form-actions > button#submit-btn.btn.btn-primary.lg
XPath: /html/body/div/main/form/div[3]/button
Bounding Rect: x=340, y=512, width=120, height=44

Attributes:
  type = "submit"
  disabled = "false"
  data-testid = "submit-button"

Text Content: "Save Changes"

Computed Styles:
  background-color: rgb(59, 130, 246)
  color: rgb(255, 255, 255)
  font-size: 14px
  padding: 8px 16px
  border-radius: 6px
  cursor: pointer

Parent Chain:
  div.form-actions (340x60)
  └─ form#settings-form (680x540)
     └─ main.content (680x800)
        └─ div#app (1024x768)
```

The AI also receives a **cropped PNG screenshot** of just the selected element, so it can see exactly what it looks like on screen.

<details>
<summary><strong>Full field reference</strong></summary>

| Field | Description |
|-------|-------------|
| **Element** | HTML tag name |
| **ID** | Element's `id` attribute (if set) |
| **Classes** | Space-separated CSS class list |
| **CSS Selector** | A unique CSS selector path to the element |
| **XPath** | XPath expression to the element |
| **Bounding Rect** | Position (`x`, `y`) and size (`width`, `height`) in pixels |
| **Attributes** | All HTML attributes on the element |
| **Text Content** | Visible text content (truncated to 200 characters) |
| **Computed Styles** | Key CSS properties as computed by the browser |
| **Parent Chain** | Ancestor elements with tag, id, classes, and dimensions |
| **Screenshot** | Cropped PNG image of the selected element |

</details>

## Real-World Workflows

### Fix This Style

A designer flags a visual issue. Use `/select` to point at the element and let the AI propose a fix.

```
You: /select this button doesn't match our design system — wrong border radius

AI: I'll activate the element picker so you can show me the button.

    [You click the button]

    Got it. Here's what I see:
    - Element: <button> with class "action-btn"
    - Current border-radius: 2px
    - Located in: src/components/ActionBar.vue

    Your design system uses 8px border-radius for buttons.
    I'll update the .action-btn class in ActionBar.vue...
```

### What Is This?

You've inherited a codebase and want to understand what a UI element actually is.

```
You: /select what component renders this widget? I can't find it in the source

AI: Let me activate the picker so you can show me.

    [You click the widget]

    That element is:
    - Element: <div> with class "metric-card"
    - CSS Selector: .dashboard-grid > div.metric-card:nth-child(3)
    - data-testid: "revenue-metric"

    Searching your codebase... This is rendered by the
    MetricCard component at src/components/MetricCard.tsx:42,
    used in the Dashboard page at src/pages/Dashboard.tsx:18.
```

### I Noticed Something

You're testing the app and spot a glitch. Alt+Shift+Click it on the spot, then come back to the AI later.

```
[While testing, you notice a layout glitch and Alt+Shift+Click the element]
[Green flash confirms the selection]
[You continue testing...]

You: I pointed at an element earlier — there's a layout shift happening on that component

AI: Let me retrieve the element you pointed at.

    I can see the element:
    - Element: <div> with class "sidebar-nav"
    - Width: 248px, Height: 100vh
    - position: fixed, left: 0

    The layout shift is likely caused by the sidebar not reserving
    space in the document flow. Since it's position: fixed, the
    main content area isn't accounting for its 248px width...
```

## The Picker UX — What Happens on Screen

### Desktop

When the agent-initiated picker activates:

1. A translucent blue overlay covers the app
2. As you move your cursor, elements highlight with a blue outline
3. A tooltip appears showing `tag#id.class (WxH)` for the hovered element
4. A small cancel bar appears with move and close buttons
5. Click an element to select it, or press **Escape** to cancel

::: tip
If the cancel bar covers the element you want to pick, you can drag it to a different position.
:::

### Mobile

On mobile devices, the picker uses a **two-tap flow**:

::: warning Two-Tap Flow on Mobile
The first tap **highlights** the element. The second tap **confirms** the selection. This prevents accidental selections on touch screens. Cancel by tapping the **X** button.
:::

1. First tap — the element highlights with a blue outline
2. Second tap — confirms the selection and returns metadata
3. Cancel — tap the X button on the cancel bar

### Alt+Shift+Click (User-Initiated)

When you Alt+Shift+Click an element:

- A **green flash border** appears around the element and fades after 1.5 seconds
- No overlay or picker UI appears — it's a quick, non-intrusive capture
- The selection is stored until the AI retrieves it

::: info
Alt+Shift+Click is available on desktop only. On mobile devices, use the agent-initiated picker instead.
:::

## Tips

- **Chain selections** — You can select multiple elements across a conversation. Each `/select` adds more context for the AI to work with.

- **Combine with DOM snapshots** — After selecting an element, use its returned CSS selector with `webview_dom_snapshot` to see the full subtree structure around it.

- **Custom timeouts** — If you need time to navigate to the right screen before picking, the picker supports timeouts up to 120 seconds (default is 60 seconds).

- **Use selectors with other tools** — The CSS selector returned by the picker works with `webview_interact`, `webview_get_styles`, `webview_find_element`, and other webview tools for follow-up actions.

## Troubleshooting

### Picker overlay doesn't appear

- Is your Tauri app running? Start it with `tauri dev`.
- Is `withGlobalTauri` enabled in your `tauri.conf.json`?
- Is the MCP bridge plugin installed and registered?
- Does the AI have an active session? It should start one automatically, but you can ask it to check with `driver_session status`.

### Clicking does nothing

- Make sure you're clicking the app content, not the cancel bar.
- On mobile, remember the **two-tap flow** — first tap highlights, second tap confirms.
- Elements inside iframes may not be selectable.

### Alt+Shift+Click — no green flash

- Confirm the MCP bridge plugin is loaded (check the browser console for bridge initialization logs).
- Alt+Shift+Click is **desktop-only**. On mobile, use the `/select` command instead.

### Screenshot failed

- The screenshot uses html2canvas under the hood, which has some limitations with certain CSS features (e.g., complex filters, some SVG elements). The element metadata is still returned even if the screenshot fails.

### Timeout

- The default timeout is 60 seconds. If you need more time to navigate to the right screen, ask the AI to use a longer timeout (up to 120 seconds).

## See Also

- [API Reference: UI Automation](/api/ui-automation#webview-select-element) — Full tool specifications for `webview_select_element` and `webview_get_pointed_element`
- [API Reference: Prompts](/api/prompts) — `/select` prompt specification
- [Using Prompts](/guides/prompts) — Guide to all available slash commands
- [Suggested Prompts](/suggested_prompts) — Copy-paste prompt examples

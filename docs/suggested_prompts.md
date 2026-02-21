# Suggested Prompts for mcp-server-tauri

These example prompts are designed for use with an AI assistant connected to this MCP server. They map directly to the tools and workflows described in the [API reference](/api/) and `AGENTS.md`.

You can copy them as-is or adapt them to your project.

---

## 1. Project Setup & Configuration

**Prompt:**

"Help me set up the Tauri MCP bridge plugin in my existing Tauri v2 app.

Please:
- Inspect my repo structure and Tauri config files.
- Tell me what files I need to add or update to install `@hypothesi/tauri-plugin-mcp-bridge`.
- Update my Tauri config to register the plugin.
- Add any required Rust code to `src-tauri` and explain where it goes.
- Finish by telling me how to run the app so the MCP server can connect."

**Prompt:**

"Review my Tauri configuration and summarize anything relevant for MCP usage.

Please:
- Find my main Tauri config and plugin registration.
- List which windows exist and how they are configured.
- Identify anything that might interfere with the MCP bridge (e.g., CSP, dev server URLs).
- Suggest any changes needed so UI automation and IPC monitoring will work reliably."

---

## 2. Mobile Devices & Simulators

These prompts use the **mobile development** tools (see [/api/mobile-development](/api/mobile-development)).

**Prompt:**

"List all available Android emulators and iOS simulators on my machine.

Tell me:
- Which ones are currently running.
- For each device: name, platform, and OS version.
- Which device you recommend for testing this app and why."

**Prompt:**

"Start an Android emulator suitable for my Tauri app and confirm when it is ready for UI testing.

Then:
- Explain how you will connect the Tauri app to this device.
- Describe any extra steps I need to take (e.g., running `npm run tauri android dev`)."

---

## 3. UI Automation & Visual Testing

These prompts use the **UI automation** and **webview interaction** tools (see [/api/ui-automation](/api/ui-automation) and [/api/webview-interaction](/api/webview-interaction)).

**Prompt:**

"Connect to my running Tauri app and verify that the login flow works.

Please:
- Open the main window.
- Type a test email and password into the login form.
- Click the login button.
- Wait for navigation or any success indicator.
- Report whether the login succeeded and capture a screenshot of the resulting page."

**Prompt:**

"Find the primary call-to-action button on the home screen and verify it is visible and clickable.

Steps:
- Wait for the main window and root view to load.
- Locate the button by its text or data attributes.
- Verify it is enabled, visible, and not overlapped.
- Take a screenshot and annotate what you interacted with.
- Report any console errors that occurred while testing this interaction."

**Prompt:**

"Inspect the styles applied to the header navigation element.

Please:
- Locate the header nav bar element by selector.
- Show me its computed CSS (colors, font, layout-related properties).
- Explain anything that might cause layout issues or overflow on smaller screens."

---

## 4. Element Picking & Visual Selection

These prompts use the **element picker** tools (see [/api/ui-automation](/api/ui-automation#webview-select-element)).

**Prompt:**

"I need to discuss a specific element in my running Tauri app.

Please:
- Connect to my running app.
- Activate the element picker so I can click on the element I want to discuss.
- Once I select it, show me the element's metadata (tag, classes, styles, selector).
- Help me understand how that element is styled and suggest improvements."

**Prompt:**

"I Alt+Shift+Clicked an element in my Tauri app. Can you tell me about it?

Please:
- Retrieve the pointed element's metadata.
- Show me its CSS selector, computed styles, and position.
- Take a screenshot of just that element.
- Suggest any accessibility or styling issues you notice."

**Prompt:**

"/select this button looks wrong on dark mode"

---

## 4b. JavaScript Errors & Console Debugging

These prompts lean on console log and JavaScript execution tools.

Unhandled errors and unhandled promise rejections in the webview are automatically
logged via `console.error` with the prefixes `[MCP_UNHANDLED_ERROR]` and
`[MCP_UNHANDLED_REJECTION]`, which you can access through `tauri_read_logs` with
`source: "console"`.

**Prompt:**

"My Tauri app is throwing errors when I click a button, but I cannot see them clearly.

Please:
- Attach to the running webview.
- Clear the console.
- Click the problematic button.
- Capture and summarize all console logs and stack traces.
- Suggest likely causes and the next code locations I should inspect."

**Prompt:**

"Show me all unhandled errors and unhandled promise rejections from the webview
in the last 5 minutes.

Please:
- Call `tauri_read_logs` with `source: "console"`.
- Filter logs for `[MCP_UNHANDLED_ERROR]` or `[MCP_UNHANDLED_REJECTION]`.
- Summarize the distinct error messages and how often they occurred.
- Suggest where in the codebase I should start investigating for each one."

**Prompt:**

"Run a small JavaScript snippet in the main webview to confirm the app's runtime state.

I want to know:
- What the current route is.
- Whether a specific global variable (or store entry) is set.
- Whether any uncaught promise rejections are present in the console logs."

---

## 5. IPC Monitoring & Backend Debugging

These prompts use the **IPC plugin** tools (see [/api/ipc-plugin](/api/ipc-plugin)).

**Prompt:**

"Set up IPC monitoring for my Tauri app and show me everything that happens when I open the settings page.

Please:
- Start an IPC monitor session.
- Trigger the navigation to the settings page (via UI or command).
- Capture all IPC invocations and events during that period.
- Summarize which commands are called and with what arguments.
- Point out any failures, timeouts, or suspicious patterns."

**Prompt:**

"I want to debug why a specific IPC command (for example `get_user_profile`) is failing.

Please:
- Start IPC monitoring.
- Trigger the feature in the UI that calls this command.
- Use `tauri_ipc_get_captured` (or equivalent) to retrieve the captured traffic.
- Show the request and response payloads.
- Suggest changes to either frontend or backend code to make error handling more descriptive."

---

## 6. E2E Testing with the Test App

These prompts focus on `packages/test-app` and end-to-end flows.

**Prompt:**

"Create or update an end-to-end test in `packages/test-app` that validates IPC monitoring.

The test should:
- Launch the `test-app`.
- Start a Tauri driver session and an IPC monitoring session.
- Trigger a known IPC command from the frontend (e.g., `invoke('ping')`).
- Assert that the IPC plugin captured the call with the expected payload.
- Clean up by stopping the monitor session and closing the app.
- Integrate with the existing test runner used in this repo."

**Prompt:**

"Review the existing end-to-end tests in `packages/test-app`.

Please:
- List the main flows currently covered.
- Identify any missing coverage for mobile, UI automation, or IPC.
- Propose 2–3 additional test cases that would significantly improve confidence in the MCP tools."

---

## 7. Error Handling & Resilience

**Prompt:**

"Review the error handling architecture in the `mcp-server` package, especially the Driver and Manager classes.

Goals:
- Find where errors are swallowed or turned into generic messages.
- Ensure all tool failures return structured, descriptive error payloads.
- Add or refine errors for cases where the Tauri app is closed or the WebSocket connection is lost, returning messages like `Tauri app not connected`.
- Propose a consistent error format for all tools and update call sites accordingly."

**Prompt:**

"Simulate common failure scenarios for the MCP server.

Please:
- Test what happens if the Tauri app is closed while a session is active.
- Test what happens if the WebSocket cannot be established.
- Capture the current error messages returned to the AI client.
- Suggest specific code changes to make these failures clearer and more actionable."

---

## 8. Release & Version Management

These prompts follow the release process documented in `AGENTS.md`.

**Prompt:**

"Walk me through preparing a new release for this monorepo.

Please:
- Inspect the git log since the last tag to identify changes.
- Propose the correct next version (patch, minor, or major) with justification.
- Update all three changelogs (`CHANGELOG.md`, `packages/mcp-server/CHANGELOG.md`, `packages/tauri-plugin-mcp-bridge/CHANGELOG.md`).
- Update the version fields in both `package.json` files and in `Cargo.toml`.
- Explain which lock files need to be updated and how.
- Draft the final commit message and tag name."

**Prompt:**

"Validate that all version numbers in this repo are consistent for the current release.

Steps:
- Check the `version` fields in the relevant `package.json` files.
- Check the plugin's `Cargo.toml` and both `Cargo.lock` files.
- Confirm that the changelogs contain entries for every version between the last tag and the current one.
- Report any mismatches and suggest concrete edits."

---

## 9. General Development Workflow

These prompts combine multiple tools for everyday development.

**Prompt:**

"Help me debug why my Tauri app's startup is slow.

Please:
- Start a Tauri driver session and attach to the main window.
- Monitor IPC calls during startup and summarize what happens.
- Capture console logs, network-like requests, and heavy operations.
- Suggest concrete code-level optimizations based on what you see."

**Prompt:**

"Act as a Tauri development assistant.

Right now I want to:
- Build and run my app.
- Verify that all windows render without errors.
- Run a basic regression pass across the main pages (home, settings, about).
- Capture screenshots for each page.
- Report any console errors, failed IPC calls, or visual anomalies you detect."

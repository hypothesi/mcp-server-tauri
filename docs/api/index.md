---
title: API Reference - What Your AI Can Do
description: Explore 18 powerful MCP tools for Tauri development including setup, mobile development, UI automation, and IPC debugging.
head:
  - - meta
    - name: keywords
      content: tauri api, mcp tools, ai capabilities, tauri automation, ipc debugging
---

<script setup>
import { Wrench, Smartphone, Target, Zap, Rocket, Bug, FlaskConical, Activity, MessageSquareCode } from 'lucide-vue-next';
</script>

# What Your AI Can Do

Once configured, your AI assistant has **18 powerful tools** plus **slash commands** to help you build, test, and debug your Tauri application. Just ask in natural language!

## <Wrench :size="24" :stroke-width="2" class="heading-icon" /> Setup & Configuration

Use these tools when you need to install or update the MCP Bridge plugin in a Tauri project.

| Tool | What It Does |
|------|--------------|
| `get_setup_instructions` | Returns guided setup/update instructions for the MCP Bridge plugin (and reminds the AI to ask permission before editing files) |

## <MessageSquareCode :size="24" :stroke-width="2" class="heading-icon" /> Slash Commands

For guided, multi-step workflows, use **slash commands** ([prompts](https://modelcontextprotocol.io/specification/2025-06-18/server/prompts)):

| Command | What It Does |
|---------|--------------|
| `/setup` | Set up the MCP bridge plugin in your Tauri project |
| `/fix-webview-errors` | Find and fix JavaScript errors in your webview |

These commands guide your AI through a complete workflow, using multiple tools automatically.

[Learn more about prompts →](/api/prompts)

## <Smartphone :size="24" :stroke-width="2" class="heading-icon" /> Mobile Development

Work with Android and iOS without switching tools.

**Device Management**
- See what emulators and simulators you have
- Check device status and availability

::: tip Example
"Show me my Android emulators" or "List available iOS simulators"
:::

[View mobile development capabilities →](/api/mobile-development)

## <Target :size="24" :stroke-width="2" class="heading-icon" /> UI Testing & Automation

Your AI can interact with your app's interface just like a user would.

**Visual Testing**
- Click buttons, fill forms, navigate menus
- Test swipe gestures and touch interactions
- Verify UI elements exist and work correctly
- Check visual appearance with screenshots

**Debugging**
- See console logs and errors
- Inspect element styles and properties
- Run JavaScript in your app's context
- Monitor what's happening in real-time

::: tip Example
"Click the submit button and tell me if it worked" or "Take a screenshot of the login page"
:::

[View all UI automation capabilities →](/api/ui-automation)
[View all interaction capabilities →](/api/webview-interaction)

## <Zap :size="24" :stroke-width="2" class="heading-icon" /> Advanced Debugging

Deep insights into your app's internal communication.

**IPC Monitoring**
- Watch messages between frontend and backend
- Debug communication issues
- Understand event flow
- Access backend state and window information

::: tip Example
"Show me what IPC calls happen when I click login"
:::

[View all debugging capabilities →](/api/ipc-plugin)

## Common Use Cases

### <Rocket :size="20" :stroke-width="2" class="heading-icon" /> Development Workflow

**"Build and run my app"**
Your AI can start dev servers, rebuild your app, and restart when things go wrong.

**"What's in my config?"**
Quickly check settings without opening files.

**"Update my app icon path"**
Make configuration changes through conversation.

### <Bug :size="20" :stroke-width="2" class="heading-icon" /> Debugging

**"Why is this button not working?"**
Your AI can click it, check the console, and report what happened.

**"Show me the error logs"**
Access all logs without leaving your chat.

**"What CSS is applied to this element?"**
Inspect styles and understand layout issues.

### <FlaskConical :size="20" :stroke-width="2" class="heading-icon" /> Testing

**"Test the login flow"**
Walk through user interactions automatically.

**"Does the app work on mobile?"**
Launch emulators and test mobile-specific features.

**"Take screenshots of all pages"**
Generate visual documentation or regression testing baselines.

### <Activity :size="20" :stroke-width="2" class="heading-icon" /> Monitoring

**"What IPC calls happen during startup?"**
Understand your app's communication patterns.

**"Is the backend responding correctly?"**
Monitor state and debug backend issues.

## How It Works

Behind the scenes, the MCP server connects your AI assistant to your Tauri app through:

- **Native IPC (WebSocket)** - For UI automation and visual testing
- **MCP Bridge Plugin** - For direct access to IPC and backend state

You don't need to understand this to use it - just talk to your AI naturally!

## Next Steps

- Browse the [detailed tool reference](/api/ui-automation) if you want to know exactly what's available
- Check out the [Getting Started Guide](/guides/getting-started) for setup instructions
- Just start asking your AI for help with your Tauri app!

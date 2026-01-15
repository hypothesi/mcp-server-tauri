---
title: Mobile Development Tools
description: MCP tools for mobile development - list Android devices and iOS simulators.
head:
  - - meta
    - name: keywords
      content: tauri mobile, android, ios, emulator, simulator
---

# Mobile Development Tools

Tools for managing mobile development environments for Tauri apps.

## list_devices

List available Android devices and iOS simulators for mobile development.

### Parameters

None.

### Example

```json
{
  "tool": "list_devices"
}
```

### Response

Returns lists of Android devices and iOS simulators:

```
Android Devices:
emulator-5554 device product:sdk_gphone64_arm64 model:sdk_gphone64_arm64 device:emu64a

iOS Booted Simulators:
iPhone 15 Pro (XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX) (Booted)
```

## Common Use Cases

### Checking Available Devices

Before running your app on mobile, check what devices are available:

```json
{
  "tool": "list_devices"
}
```

### Mobile Development Workflow

1. Use `list_devices` to see available emulators/simulators
2. Use your terminal or IDE to run `tauri android dev` or `tauri ios dev`
3. Use `driver_session` to connect to the running app
4. Use `read_logs` with source `android` or `ios` to debug issues

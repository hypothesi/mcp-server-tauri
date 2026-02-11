// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn add_numbers(a: i32, b: i32) -> i32 {
    a + b
}

#[tauri::command]
fn get_config() -> serde_json::Value {
    serde_json::json!({
        "app_name": "test-app",
        "version": "0.1.0",
        "features": ["devtools", "mcp-bridge"]
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![greet, add_numbers, get_config]);

    #[cfg(debug_assertions)]
    {
        // Use port 9300 to avoid collision with other Tauri apps using default port 9223
        // Note: Must be within the MCP server's discovery range (9223-9322)
        builder = builder.plugin(
            tauri_plugin_mcp_bridge::Builder::new()
                .base_port(9300)
                .build(),
        );
    }

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

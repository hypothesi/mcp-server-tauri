//! Script Registry for managing persistent scripts across page navigations.
//!
//! This module provides a registry for storing script entries that should be
//! automatically re-injected when pages load or navigate.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

/// Type of script to inject.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ScriptType {
    /// Inline JavaScript code to execute directly.
    Inline,
    /// URL to an external script file.
    Url,
}

/// Allows only `https://` URLs for `ScriptType::Url` (SEC-004).
///
/// `javascript:`, `data:`, `file:`, `http:`, and schemeless values are rejected.
pub fn validate_https_script_url(content: &str) -> Result<(), String> {
    let trimmed = content.trim();
    if trimmed.is_empty() {
        return Err("script URL is empty".to_string());
    }
    if trimmed.bytes().any(|byte| byte < 0x20 || byte == 0x7f) {
        return Err("script URL contains control characters".to_string());
    }

    let Some(scheme_end) = trimmed.find(':') else {
        return Err("register_script type=url allows https only".to_string());
    };
    let scheme = &trimmed[..scheme_end];
    if !scheme.eq_ignore_ascii_case("https") {
        return Err(format!(
            "register_script type=url allows https only, got '{scheme}'"
        ));
    }
    if !trimmed[scheme_end..].starts_with("://") {
        return Err("script URL must be an https:// URL".to_string());
    }
    Ok(())
}

/// A script entry in the registry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScriptEntry {
    /// Unique identifier for this script.
    pub id: String,
    /// Type of script (inline code or external URL).
    pub script_type: ScriptType,
    /// The script content (JavaScript code) or URL.
    pub content: String,
}

/// Registry for managing persistent scripts.
///
/// Scripts added to this registry will be automatically re-injected
/// when pages load or navigate.
#[derive(Debug, Default)]
pub struct ScriptRegistry {
    scripts: HashMap<String, ScriptEntry>,
}

impl ScriptRegistry {
    /// Creates a new empty script registry.
    pub fn new() -> Self {
        Self {
            scripts: HashMap::new(),
        }
    }

    /// Adds a script entry to the registry.
    ///
    /// If a script with the same ID already exists, it will be replaced.
    pub fn add(&mut self, entry: ScriptEntry) {
        self.scripts.insert(entry.id.clone(), entry);
    }

    /// Removes a script from the registry by ID.
    ///
    /// Returns the removed entry if it existed.
    pub fn remove(&mut self, id: &str) -> Option<ScriptEntry> {
        self.scripts.remove(id)
    }

    /// Gets all scripts in the registry.
    pub fn get_all(&self) -> Vec<&ScriptEntry> {
        self.scripts.values().collect()
    }

    /// Clears all scripts from the registry.
    pub fn clear(&mut self) {
        self.scripts.clear();
    }

    /// Checks if a script with the given ID exists.
    pub fn contains(&self, id: &str) -> bool {
        self.scripts.contains_key(id)
    }

    /// Gets a script by ID.
    pub fn get(&self, id: &str) -> Option<&ScriptEntry> {
        self.scripts.get(id)
    }

    /// Returns the number of scripts in the registry.
    pub fn len(&self) -> usize {
        self.scripts.len()
    }

    /// Returns true if the registry is empty.
    pub fn is_empty(&self) -> bool {
        self.scripts.is_empty()
    }
}

/// Thread-safe wrapper for the script registry.
pub type SharedScriptRegistry = Arc<Mutex<ScriptRegistry>>;

/// Creates a new shared script registry.
pub fn create_shared_registry() -> SharedScriptRegistry {
    Arc::new(Mutex::new(ScriptRegistry::new()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_add_and_get() {
        let mut registry = ScriptRegistry::new();
        let entry = ScriptEntry {
            id: "test-script".to_string(),
            script_type: ScriptType::Inline,
            content: "console.log('hello')".to_string(),
        };

        registry.add(entry.clone());

        assert!(registry.contains("test-script"));
        assert_eq!(registry.len(), 1);

        let retrieved = registry.get("test-script").unwrap();
        assert_eq!(retrieved.id, "test-script");
        assert_eq!(retrieved.script_type, ScriptType::Inline);
    }

    #[test]
    fn test_remove() {
        let mut registry = ScriptRegistry::new();
        registry.add(ScriptEntry {
            id: "to-remove".to_string(),
            script_type: ScriptType::Url,
            content: "https://example.com/script.js".to_string(),
        });

        assert!(registry.contains("to-remove"));

        let removed = registry.remove("to-remove");
        assert!(removed.is_some());
        assert!(!registry.contains("to-remove"));
        assert!(registry.is_empty());
    }

    #[test]
    fn test_clear() {
        let mut registry = ScriptRegistry::new();
        registry.add(ScriptEntry {
            id: "script1".to_string(),
            script_type: ScriptType::Inline,
            content: "1".to_string(),
        });
        registry.add(ScriptEntry {
            id: "script2".to_string(),
            script_type: ScriptType::Inline,
            content: "2".to_string(),
        });

        assert_eq!(registry.len(), 2);

        registry.clear();
        assert!(registry.is_empty());
    }

    #[test]
    fn test_get_all() {
        let mut registry = ScriptRegistry::new();
        registry.add(ScriptEntry {
            id: "a".to_string(),
            script_type: ScriptType::Inline,
            content: "a".to_string(),
        });
        registry.add(ScriptEntry {
            id: "b".to_string(),
            script_type: ScriptType::Url,
            content: "b".to_string(),
        });

        let all = registry.get_all();
        assert_eq!(all.len(), 2);
    }

    #[test]
    fn url_script_allows_https_only() {
        assert!(validate_https_script_url("https://example.com/script.js").is_ok());
        assert!(validate_https_script_url("HTTPS://example.com/script.js").is_ok());
        assert!(validate_https_script_url("http://example.com/script.js").is_err());
        assert!(validate_https_script_url("javascript:alert(1)").is_err());
        assert!(validate_https_script_url("data:text/javascript,alert(1)").is_err());
        assert!(validate_https_script_url("file:///tmp/x.js").is_err());
        assert!(validate_https_script_url("//example.com/x.js").is_err());
        assert!(validate_https_script_url("https:example.com/x.js").is_err());
        assert!(validate_https_script_url("").is_err());
    }

    #[test]
    fn test_replace_existing() {
        let mut registry = ScriptRegistry::new();
        registry.add(ScriptEntry {
            id: "same-id".to_string(),
            script_type: ScriptType::Inline,
            content: "original".to_string(),
        });
        registry.add(ScriptEntry {
            id: "same-id".to_string(),
            script_type: ScriptType::Inline,
            content: "replaced".to_string(),
        });

        assert_eq!(registry.len(), 1);
        assert_eq!(registry.get("same-id").unwrap().content, "replaced");
    }
}

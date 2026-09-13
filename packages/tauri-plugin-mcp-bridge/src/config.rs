//! Configuration for the MCP Bridge plugin.
//!
//! This module provides configuration options for customizing the plugin behavior,
//! including the WebSocket server bind address, handshake token, and cleartext LAN opt-in.

use crate::auth::generate_token;

/// Resolved handshake token plus whether it was generated (so it can be logged once).
#[derive(Clone)]
pub struct ResolvedToken {
    /// Shared secret the MCP client must send as `X-MCP-Bridge-Token`.
    pub secret: String,
    /// True when the plugin generated this value because none was configured.
    pub generated: bool,
}

/// Configuration for the MCP Bridge plugin.
#[derive(Clone, Debug)]
pub struct Config {
    /// The address to bind the WebSocket server to.
    /// Default: "127.0.0.1" (loopback). Use "0.0.0.0" only via
    /// [`Builder::bind_address`] or `MCP_BRIDGE_BIND`.
    pub bind_address: String,
    /// True when [`Builder::bind_address`] / [`Config::new`] set the bind explicitly
    /// so `MCP_BRIDGE_BIND` must not override it.
    bind_address_explicit: bool,
    /// The base port for the WebSocket server.
    /// Default: 9223. The plugin will scan up to 100 ports from this base.
    pub base_port: u16,
    /// Explicit handshake token. When unset, `MCP_BRIDGE_TOKEN` or a generated value is used.
    token: Option<String>,
    /// Allow cleartext `ws://` on a non-loopback bind (LAN device testing).
    pub allow_insecure_cleartext: bool,
    allow_insecure_explicit: bool,
    /// Allow the operator WebSocket to bind in release builds.
    ///
    /// Debug builds always bind. Release builds log once and do not bind
    /// unless this is true ([`Builder::allow_release`]).
    pub allow_release: bool,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            bind_address: "127.0.0.1".to_string(),
            bind_address_explicit: false,
            base_port: 9223,
            token: None,
            allow_insecure_cleartext: false,
            allow_insecure_explicit: false,
            allow_release: false,
        }
    }
}

fn env_nonempty(name: &str) -> Option<String> {
    std::env::var(name)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn env_flag(name: &str) -> bool {
    matches!(
        std::env::var(name)
            .unwrap_or_default()
            .trim()
            .to_ascii_lowercase()
            .as_str(),
        "1" | "true" | "yes"
    )
}

impl Config {
    /// Creates a new configuration with the specified bind address.
    pub fn new(bind_address: &str) -> Self {
        Self {
            bind_address: bind_address.to_string(),
            bind_address_explicit: true,
            base_port: 9223,
            token: None,
            allow_insecure_cleartext: false,
            allow_insecure_explicit: false,
            allow_release: false,
        }
    }

    /// Creates a configuration that binds to localhost only.
    pub fn localhost_only() -> Self {
        Self {
            bind_address: "127.0.0.1".to_string(),
            bind_address_explicit: true,
            base_port: 9223,
            token: None,
            allow_insecure_cleartext: false,
            allow_insecure_explicit: false,
            allow_release: false,
        }
    }

    /// Bind used at plugin setup: explicit builder value, else `MCP_BRIDGE_BIND`, else loopback.
    pub fn effective_bind_address(&self) -> String {
        if self.bind_address_explicit {
            return self.bind_address.clone();
        }
        env_nonempty("MCP_BRIDGE_BIND").unwrap_or_else(|| self.bind_address.clone())
    }

    /// Cleartext LAN opt-in: explicit builder value, else `MCP_BRIDGE_ALLOW_INSECURE_CLEARTEXT`.
    pub fn effective_allow_insecure_cleartext(&self) -> bool {
        if self.allow_insecure_explicit {
            return self.allow_insecure_cleartext;
        }
        env_flag("MCP_BRIDGE_ALLOW_INSECURE_CLEARTEXT")
    }

    /// Token used at plugin setup: builder, else `MCP_BRIDGE_TOKEN`, else generated 128-bit hex.
    pub fn resolve_token(&self) -> ResolvedToken {
        if let Some(token) = self
            .token
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            return ResolvedToken {
                secret: token.to_string(),
                generated: false,
            };
        }
        if let Some(token) = env_nonempty("MCP_BRIDGE_TOKEN") {
            return ResolvedToken {
                secret: token,
                generated: false,
            };
        }
        ResolvedToken {
            secret: generate_token(),
            generated: true,
        }
    }
}

/// Whether the operator WebSocket should bind.
///
/// `init()` / [`Builder::build`] pass `cfg!(debug_assertions)` and
/// [`Config::allow_release`]. Release binaries no-op unless
/// [`Builder::allow_release`] is set.
pub fn should_bind_websocket(debug_assertions: bool, allow_release: bool) -> bool {
    debug_assertions || allow_release
}

/// Builder for creating a configured MCP Bridge plugin.
///
/// # Examples
///
/// ```rust,ignore
/// use tauri_plugin_mcp_bridge::Builder;
///
/// // Default: binds to 127.0.0.1 (loopback) in debug builds; requires X-MCP-Bridge-Token
/// let plugin: tauri::plugin::TauriPlugin<tauri::Wry> = Builder::new().build();
///
/// // Release binary bridge (explicit opt-in):
/// let plugin: tauri::plugin::TauriPlugin<tauri::Wry> =
///     Builder::new().allow_release(true).build();
///
/// // LAN device testing (cleartext, explicit opt-in):
/// let plugin: tauri::plugin::TauriPlugin<tauri::Wry> = Builder::new()
///     .bind_address("0.0.0.0")
///     .allow_insecure_cleartext(true)
///     .token("replace-me")
///     .build();
/// ```
pub struct Builder {
    config: Config,
}

impl Default for Builder {
    fn default() -> Self {
        Self::new()
    }
}

impl Builder {
    /// Creates a new builder with default configuration.
    pub fn new() -> Self {
        Self {
            config: Config::default(),
        }
    }

    /// Sets the bind address for the WebSocket server.
    ///
    /// # Arguments
    ///
    /// * `addr` - The address to bind to (e.g., "0.0.0.0" or "127.0.0.1")
    ///
    /// Non-loopback addresses also require [`Self::allow_insecure_cleartext`].
    ///
    /// # Examples
    ///
    /// ```rust
    /// use tauri_plugin_mcp_bridge::Builder;
    ///
    /// let builder = Builder::new().bind_address("127.0.0.1");
    /// ```
    pub fn bind_address(mut self, addr: &str) -> Self {
        self.config.bind_address = addr.to_string();
        self.config.bind_address_explicit = true;
        self
    }

    /// Sets the base port for the WebSocket server.
    ///
    /// The plugin will scan up to 100 ports starting from this base port.
    ///
    /// # Arguments
    ///
    /// * `port` - The base port number (e.g., 9223)
    ///
    /// # Examples
    ///
    /// ```rust
    /// use tauri_plugin_mcp_bridge::Builder;
    ///
    /// let builder = Builder::new().base_port(9323);
    /// ```
    pub fn base_port(mut self, port: u16) -> Self {
        self.config.base_port = port;
        self
    }

    /// Sets the WebSocket handshake token (`X-MCP-Bridge-Token`).
    ///
    /// If unset, `MCP_BRIDGE_TOKEN` is used; otherwise a 128-bit hex token is generated.
    pub fn token(mut self, token: impl Into<String>) -> Self {
        self.config.token = Some(token.into());
        self
    }

    /// Allows cleartext `ws://` when binding off loopback (LAN device testing).
    ///
    /// Without this (or `MCP_BRIDGE_ALLOW_INSECURE_CLEARTEXT=1`), a non-loopback
    /// bind is refused.
    pub fn allow_insecure_cleartext(mut self, allow: bool) -> Self {
        self.config.allow_insecure_cleartext = allow;
        self.config.allow_insecure_explicit = true;
        self
    }

    /// Allows the operator WebSocket listener in release builds.
    ///
    /// Without this, [`crate::init`] and [`Self::build`] log once and do not
    /// bind in release (`debug_assertions` off). Debug builds always bind.
    pub fn allow_release(mut self, allow: bool) -> Self {
        self.config.allow_release = allow;
        self
    }

    /// Builds the plugin with the configured options.
    pub fn build<R: tauri::Runtime>(self) -> tauri::plugin::TauriPlugin<R> {
        crate::init_with_config(self.config)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::auth::is_loopback_bind;

    #[test]
    fn default_bind_is_loopback() {
        let config = Config::default();
        assert_eq!(config.bind_address, "127.0.0.1");
        assert!(is_loopback_bind(&config.bind_address));
        assert!(!config.allow_insecure_cleartext);
    }

    #[test]
    fn localhost_only_and_new_are_explicit_binds() {
        assert_eq!(
            Config::localhost_only().effective_bind_address(),
            "127.0.0.1"
        );
        assert_eq!(Config::new("0.0.0.0").effective_bind_address(), "0.0.0.0");
        let built = Builder::new().bind_address("0.0.0.0").config;
        assert_eq!(built.effective_bind_address(), "0.0.0.0");
        assert!(built.bind_address_explicit);
    }

    #[test]
    fn builder_token_is_used() {
        let token = Builder::new().token("from-builder").config.resolve_token();
        assert_eq!(token.secret, "from-builder");
        assert!(!token.generated);
    }

    #[test]
    fn builder_allow_insecure_is_explicit() {
        let config = Builder::new().allow_insecure_cleartext(true).config;
        assert!(config.effective_allow_insecure_cleartext());
        let denied = Builder::new().allow_insecure_cleartext(false).config;
        assert!(!denied.effective_allow_insecure_cleartext());
    }

    #[test]
    fn websocket_bind_is_debug_or_allow_release() {
        assert!(should_bind_websocket(true, false));
        assert!(should_bind_websocket(true, true));
        assert!(!should_bind_websocket(false, false));
        assert!(should_bind_websocket(false, true));
    }

    #[test]
    fn init_defaults_do_not_allow_release() {
        assert!(!Config::default().allow_release);
        assert!(!Builder::new().config.allow_release);
        assert!(Builder::new().allow_release(true).config.allow_release);
        assert!(!Builder::new().allow_release(false).config.allow_release);
    }

    #[test]
    fn cargo_test_profile_honors_debug_assertions() {
        assert_eq!(
            should_bind_websocket(cfg!(debug_assertions), false),
            cfg!(debug_assertions)
        );
    }
}

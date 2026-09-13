//! Handshake authentication and bind policy for the operator WebSocket.
//!
//! The MCP control plane is this token-gated WebSocket, not Tauri webview
//! capability ACL (SEC-002). Browsers cannot attach `X-MCP-Bridge-Token`,
//! which is the CSWSH control (SEC-010). Query strings and cookies are ignored.

use std::net::IpAddr;
use std::path::PathBuf;

use tokio_tungstenite::tungstenite::handshake::server::{
    Callback, ErrorResponse, Request, Response,
};
use tokio_tungstenite::tungstenite::http::{Response as HttpResponse, StatusCode};

/// HTTP header the MCP client must send on WebSocket upgrade.
///
/// Must stay in lockstep with `MCP_BRIDGE_TOKEN_HEADER` in the TypeScript client.
pub const TOKEN_HEADER: &str = "X-MCP-Bridge-Token";

/// File name under the process temp directory for the generated/current token.
pub const TOKEN_FILE_NAME: &str = "hypothesi-mcp-bridge.token";

/// Well-known path the local MCP (or operator) can read.
pub fn token_file_path() -> PathBuf {
    std::env::temp_dir().join(TOKEN_FILE_NAME)
}

/// 128-bit token as 32 lowercase hex characters.
pub fn generate_token() -> String {
    let mut bytes = [0u8; 16];
    getrandom::getrandom(&mut bytes).expect("OS RNG required to generate MCP Bridge token");
    hex_encode(&bytes)
}

fn hex_encode(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for &b in bytes {
        out.push(HEX[(b >> 4) as usize] as char);
        out.push(HEX[(b & 0x0f) as usize] as char);
    }
    out
}

/// Constant-time compare of UTF-8 tokens. Empty expected tokens never match.
pub fn tokens_match(provided: &str, expected: &str) -> bool {
    let provided = provided.trim().as_bytes();
    let expected = expected.trim().as_bytes();
    if expected.is_empty() || provided.len() != expected.len() {
        return false;
    }
    provided
        .iter()
        .zip(expected.iter())
        .fold(0u8, |acc, (a, b)| acc | (a ^ b))
        == 0
}

/// Writes the token for the local MCP to read. Unix creates the file mode 0600.
pub fn persist_token(token: &str) -> std::io::Result<PathBuf> {
    persist_token_to(&token_file_path(), token)?;
    Ok(token_file_path())
}

pub fn persist_token_to(path: &std::path::Path, token: &str) -> std::io::Result<()> {
    #[cfg(unix)]
    {
        use std::io::Write;
        use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};

        // Drop any leftover inode so a previous 0644 file never receives the secret.
        match std::fs::remove_file(path) {
            Ok(()) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(error),
        }

        let mut file = std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .mode(0o600)
            .open(path)?;
        file.write_all(token.as_bytes())?;
        file.set_permissions(std::fs::Permissions::from_mode(0o600))?;
        Ok(())
    }
    #[cfg(not(unix))]
    {
        std::fs::write(path, token)
    }
}

/// Loopback bind targets: 127.0.0.0/8, ::1, and the name "localhost".
pub fn is_loopback_bind(addr: &str) -> bool {
    let addr = addr.trim();
    if addr.eq_ignore_ascii_case("localhost") {
        return true;
    }
    match addr.parse::<IpAddr>() {
        Ok(ip) => ip.is_loopback(),
        Err(_) => false,
    }
}

/// Non-loopback cleartext binds require an explicit opt-in (SEC-018).
pub fn validate_bind_policy(
    bind_address: &str,
    allow_insecure_cleartext: bool,
) -> Result<(), String> {
    if is_loopback_bind(bind_address) {
        return Ok(());
    }
    if allow_insecure_cleartext {
        return Ok(());
    }
    Err(format!(
        "Refusing to bind MCP Bridge to {bind_address} over cleartext ws://. \
         Non-loopback binds require Builder::allow_insecure_cleartext(true) or \
         MCP_BRIDGE_ALLOW_INSECURE_CLEARTEXT=1, and a handshake token (SEC-018)."
    ))
}

fn unauthorized_response() -> ErrorResponse {
    let mut response = HttpResponse::new(Some("Unauthorized".to_string()));
    *response.status_mut() = StatusCode::UNAUTHORIZED;
    response
}

/// Authorize a WebSocket upgrade using only `X-MCP-Bridge-Token`.
///
/// Query strings and Cookie headers are intentionally ignored so a browser
/// cannot complete this handshake (SEC-001, SEC-010).
#[allow(clippy::result_large_err)] // tungstenite ErrorResponse is a full HTTP response
pub fn authorize_upgrade(
    request: &Request,
    response: Response,
    expected_token: &str,
) -> Result<Response, ErrorResponse> {
    let provided = request
        .headers()
        .get(TOKEN_HEADER)
        .and_then(|value| value.to_str().ok());

    match provided {
        Some(token) if tokens_match(token, expected_token) => Ok(response),
        _ => Err(unauthorized_response()),
    }
}

/// `accept_hdr_async` callback. Named type so the HRTB on [`Callback`] is satisfied.
pub struct TokenCallback {
    token: String,
}

impl TokenCallback {
    pub fn new(token: impl Into<String>) -> Self {
        Self {
            token: token.into(),
        }
    }
}

impl Callback for TokenCallback {
    #[allow(clippy::result_large_err)] // tungstenite ErrorResponse is a full HTTP response
    fn on_request(self, request: &Request, response: Response) -> Result<Response, ErrorResponse> {
        authorize_upgrade(request, response, &self.token)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio_tungstenite::tungstenite::http::Request as HttpRequest;

    fn request_with_header(name: Option<(&str, &str)>) -> Request {
        let mut builder = HttpRequest::builder().method("GET").uri("/");
        if let Some((header, value)) = name {
            builder = builder.header(header, value);
        }
        builder.body(()).expect("request")
    }

    #[test]
    fn generate_token_is_128_bit_hex() {
        let token = generate_token();
        assert_eq!(token.len(), 32);
        assert!(
            token.chars().all(|c| c.is_ascii_hexdigit()),
            "{token} should be hex"
        );
        assert_ne!(token, generate_token());
    }

    #[test]
    fn tokens_match_rejects_missing_wrong_and_empty() {
        assert!(tokens_match("secret-token", "secret-token"));
        assert!(tokens_match(" secret-token\n", "secret-token"));
        assert!(!tokens_match("wrong", "secret-token"));
        assert!(!tokens_match("", "secret-token"));
        assert!(!tokens_match("secret-token", ""));
        assert!(!tokens_match("secret-token", "secret-tokenx"));
    }

    #[test]
    fn default_loopback_bind_and_lan_requires_flag() {
        assert!(is_loopback_bind("127.0.0.1"));
        assert!(is_loopback_bind("127.0.0.2"));
        assert!(is_loopback_bind("::1"));
        assert!(is_loopback_bind("localhost"));
        assert!(!is_loopback_bind("0.0.0.0"));
        assert!(!is_loopback_bind("192.168.1.9"));
        assert!(!is_loopback_bind("::"));

        assert!(validate_bind_policy("127.0.0.1", false).is_ok());
        assert!(validate_bind_policy("0.0.0.0", false).is_err());
        assert!(validate_bind_policy("0.0.0.0", true).is_ok());
        assert!(validate_bind_policy("192.168.1.9", false).is_err());
        assert!(validate_bind_policy("192.168.1.9", true).is_ok());
    }

    #[test]
    fn upgrade_rejects_missing_and_wrong_token() {
        let expected = "secret-token";
        let ok = request_with_header(Some((TOKEN_HEADER, expected)));
        assert!(authorize_upgrade(&ok, Response::new(()), expected).is_ok());

        let missing = request_with_header(None);
        assert!(authorize_upgrade(&missing, Response::new(()), expected).is_err());

        let wrong = request_with_header(Some((TOKEN_HEADER, "nope")));
        assert!(authorize_upgrade(&wrong, Response::new(()), expected).is_err());
    }

    #[test]
    fn upgrade_ignores_query_string_and_cookie() {
        let expected = "secret-token";
        let query = HttpRequest::builder()
            .method("GET")
            .uri(format!("/?{TOKEN_HEADER}={expected}&token={expected}"))
            .body(())
            .expect("query request");
        assert!(authorize_upgrade(&query, Response::new(()), expected).is_err());

        let cookie = request_with_header(Some(("Cookie", "X-MCP-Bridge-Token=secret-token")));
        assert!(authorize_upgrade(&cookie, Response::new(()), expected).is_err());
    }

    #[test]
    fn persist_token_to_round_trips() {
        let dir = std::env::temp_dir();
        let path = dir.join(format!(
            "hypothesi-mcp-bridge-test-{}.token",
            std::process::id()
        ));
        persist_token_to(&path, "abc123").expect("write");
        let body = std::fs::read_to_string(&path).expect("read");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = std::fs::metadata(&path)
                .expect("metadata")
                .permissions()
                .mode()
                & 0o777;
            assert_eq!(mode, 0o600);
        }
        let _ = std::fs::remove_file(&path);
        assert_eq!(body, "abc123");
    }

    #[test]
    fn token_file_path_is_well_known() {
        assert_eq!(
            token_file_path(),
            std::env::temp_dir().join(TOKEN_FILE_NAME)
        );
    }
}

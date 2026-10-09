# Tauri 2.12.0 compatibility release

Version `0.13.1-tauri.2.12.0.1` branches from `v0.13.1` on
`compat/tauri-2.12.0`. It retains the 0.13.1 fixes and requires exactly
Tauri 2.12.0 and JavaScript API 2.12.0. Rust 1.90 remains required.

All three npm packages publish with the `tauri-2-12-0` tag through their
`publishConfig`; the workflow also passes that tag explicitly. The normal
`latest` channel stays on the normal release.
GitHub marks the compatibility release as a prerelease and does not make it
latest. Cargo consumers must explicitly opt into the prerelease.

## Installation

```bash
npm install --save-exact @hypothesi/tauri-plugin-mcp-bridge@0.13.1-tauri.2.12.0.1 @tauri-apps/api@2.12.0
npm install --save-exact @hypothesi/tauri-mcp-cli@0.13.1-tauri.2.12.0.1
```

```toml
[dependencies]
tauri = "=2.12.0"
tauri-plugin-mcp-bridge = "=0.13.1-tauri.2.12.0.1"
```

## Seven-day release age

The release audit checks npm production dependencies from `package-lock.json`
and every registry crate in both Cargo lockfiles against registry publication
timestamps. The cutoff is seven days before the audit time.

Audit on 2026-10-09T18:39:57.356619+00:00 verified 662 dependency versions (163 npm production
versions and 499 Rust crate versions). All were published before the cutoff
2026-10-02T18:38:06.691595+00:00.

The compatibility lockfiles downgrade these otherwise too-recent crates:

* `objc2`: 0.6.5 to 0.6.4
* `serde_spanned`: 1.1.2 to 1.1.1
* `toml`: 1.1.8 to 1.1.6
* `toml_datetime`: 1.1.2 to 1.1.1
* `toml_parser`: 1.1.5 to 1.1.3
* `toml_writer`: 1.1.3 to 1.1.2

Consumer dependency resolution can select newer transitive versions because
library lockfiles do not constrain a consuming application. Consumers must
apply their release-age policy during resolution and preserve their own
lockfiles. This release pins the direct Tauri and JavaScript API versions.

The newly published compatibility packages themselves reach seven days of
age seven days after publication. An age policy covering these packages needs
that waiting period or a client-approved exception.

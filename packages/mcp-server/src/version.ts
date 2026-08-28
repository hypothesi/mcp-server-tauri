/**
 * Version information for the MCP Bridge plugin.
 *
 * Reads the version from this package's package.json at runtime.
 * Both packages share the same version (monorepo single-version policy).
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url),
      pkg = require('../package.json') as { version: string },
      [ major, minor ] = pkg.version.split('.');

/**
 * Full version string (e.g., "0.6.5")
 */
export const PLUGIN_VERSION_FULL = pkg.version;

/**
 * Cargo-compatible version string for Cargo.toml dependencies (e.g., "0.6")
 * This is the major.minor version used in Cargo.toml dependency specifications.
 */
export const PLUGIN_VERSION_CARGO = `${major}.${minor}`;

/**
 * Describe version skew between plugin and server.
 * Returns null if versions match (major.minor), otherwise returns an upgrade message.
 */
export function describeVersionSkew(pluginVersion: string | null): string | null {
   if (!pluginVersion) {
      return 'The connected app cannot report its plugin version. ' +
         `Update tauri-plugin-mcp-bridge to ${PLUGIN_VERSION_CARGO} and rebuild the app.`;
   }

   const [ pMajor, pMinor ] = pluginVersion.split('.'),
         [ sMajor, sMinor ] = PLUGIN_VERSION_FULL.split('.');

   if (pMajor === sMajor && pMinor === sMinor) {
      return null;
   }

   return `Plugin ${pluginVersion} does not match server ${PLUGIN_VERSION_FULL}. ` +
      `Set tauri-plugin-mcp-bridge = "${PLUGIN_VERSION_CARGO}" in Cargo.toml and rebuild the app.`;
}

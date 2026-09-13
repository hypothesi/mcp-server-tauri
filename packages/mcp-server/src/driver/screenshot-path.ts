import { mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const SCREENSHOT_DIR_ENV = 'TAURI_MCP_SCREENSHOT_DIR';
export const DEFAULT_SCREENSHOT_DIRNAME = 'tauri-mcp-screenshots';

/**
 * Directory that screenshot / CLI image writes are confined to.
 *
 * Override with TAURI_MCP_SCREENSHOT_DIR (resolved) for tests or a custom root.
 * Defaults to os.tmpdir()/tauri-mcp-screenshots.
 */
export function getScreenshotJailRoot(): string {
   // eslint-disable-next-line no-process-env
   const override = process.env[SCREENSHOT_DIR_ENV];

   if (override && override.trim() !== '') {
      return path.resolve(override);
   }

   return path.resolve(os.tmpdir(), DEFAULT_SCREENSHOT_DIRNAME);
}

export async function ensureScreenshotJail(jailRoot: string = getScreenshotJailRoot()): Promise<string> {
   const resolvedJail = path.resolve(jailRoot);

   await mkdir(resolvedJail, { recursive: true });

   return resolvedJail;
}

/**
 * Resolve filePath inside the screenshot jail.
 *
 * Relative paths are taken relative to the jail so operator filenames still work.
 * Absolute paths (POSIX or Windows, including foreign-platform forms) must
 * canonicalize inside the jail; `..` and other escapes are rejected.
 */
export function resolveScreenshotOutputPath(filePath: string, jailRoot: string = getScreenshotJailRoot()): string {
   if (filePath.length === 0 || filePath.includes('\0')) {
      throw createJailError(jailRoot);
   }

   const resolvedJail = path.resolve(jailRoot);

   if (isForeignAbsolutePath(filePath)) {
      throw createJailError(resolvedJail);
   }

   const candidate = path.isAbsolute(filePath)
      ? path.resolve(filePath)
      : path.resolve(resolvedJail, filePath);

   if (!isPathInsideScreenshotJail(candidate, resolvedJail)) {
      throw createJailError(resolvedJail);
   }

   return candidate;
}

export function isPathInsideScreenshotJail(candidate: string, jailRoot: string): boolean {
   const resolvedCandidate = toComparablePath(path.resolve(candidate));

   const resolvedJail = toComparablePath(path.resolve(jailRoot));

   const relative = path.relative(resolvedJail, resolvedCandidate);

   if (relative.length === 0 || path.isAbsolute(relative)) {
      return false;
   }

   const firstSegment = relative.split(/[\\/]/)[0];

   return firstSegment !== '..';
}

function isForeignAbsolutePath(filePath: string): boolean {
   if (process.platform === 'win32') {
      return false;
   }

   // On POSIX, a Windows drive/UNC path is not a jail-relative filename.
   return path.win32.isAbsolute(filePath) && !path.posix.isAbsolute(filePath);
}

function toComparablePath(filePath: string): string {
   return process.platform === 'win32' ? filePath.toLowerCase() : filePath;
}

function createJailError(jailRoot: string): Error {
   return new Error(`Screenshot path must stay inside ${path.resolve(jailRoot)}`);
}

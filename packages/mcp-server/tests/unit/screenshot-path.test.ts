import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
   getScreenshotJailRoot,
   isPathInsideScreenshotJail,
   resolveScreenshotOutputPath,
} from '../../src/driver/screenshot-path';

describe('screenshot path jail', () => {
   const originalEnv = process.env;

   beforeEach(() => {
      process.env = { ...originalEnv };
      delete process.env.TAURI_MCP_SCREENSHOT_DIR;
   });

   afterEach(() => {
      process.env = originalEnv;
   });

   it('defaults to os.tmpdir()/tauri-mcp-screenshots', () => {
      expect(getScreenshotJailRoot()).toBe(path.resolve(os.tmpdir(), 'tauri-mcp-screenshots'));
   });

   it('uses TAURI_MCP_SCREENSHOT_DIR when set', () => {
      const jail = path.join(os.tmpdir(), 'custom-tauri-mcp-jail');

      process.env.TAURI_MCP_SCREENSHOT_DIR = jail;

      expect(getScreenshotJailRoot()).toBe(path.resolve(jail));
   });

   it('resolves a relative operator filename inside the jail', () => {
      const jail = path.join(os.tmpdir(), 'custom-tauri-mcp-jail');

      expect(resolveScreenshotOutputPath('shot.png', jail)).toBe(path.resolve(jail, 'shot.png'));
   });

   it('rejects C:\\Windows\\Temp\\..\\evil.png', () => {
      const jail = path.join(os.tmpdir(), 'custom-tauri-mcp-jail');

      expect(() => { return resolveScreenshotOutputPath('C:\\Windows\\Temp\\..\\evil.png', jail); }).toThrow(/must stay inside/i);
   });

   it('rejects /tmp/evil', () => {
      const jail = path.join(os.tmpdir(), 'custom-tauri-mcp-jail');

      expect(() => { return resolveScreenshotOutputPath('/tmp/evil', jail); }).toThrow(/must stay inside/i);
   });

   it('rejects .. traversal after canonicalize', () => {
      const jail = path.join(os.tmpdir(), 'custom-tauri-mcp-jail');

      expect(() => { return resolveScreenshotOutputPath('../evil.png', jail); }).toThrow(/must stay inside/i);
      expect(() => { return resolveScreenshotOutputPath('nested/../../evil.png', jail); }).toThrow(/must stay inside/i);
   });

   it('does not treat a sibling of the jail as inside', () => {
      const jail = path.join(os.tmpdir(), 'custom-tauri-mcp-jail');

      expect(isPathInsideScreenshotJail(path.join(os.tmpdir(), 'custom-tauri-mcp-jail-evil', 'x.png'), jail)).toBe(false);
   });
});

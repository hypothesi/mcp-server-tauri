import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { writeImageFiles } from '../../src/image-output';

vi.mock('node:fs/promises', () => {
   return {
      mkdir: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
   };
});

const PNG_PIXEL = 'aaaa';

function imageContent(): Array<{ type: 'image'; data: string; mimeType: string }> {
   return [ { type: 'image', data: PNG_PIXEL, mimeType: 'image/png' } ];
}

describe('CLI image output jail', () => {
   const originalEnv = process.env;

   const mockWriteFile = vi.mocked(writeFile);

   const mockMkdir = vi.mocked(mkdir);

   beforeEach(() => {
      process.env = { ...originalEnv };
      delete process.env.TAURI_MCP_SCREENSHOT_DIR;
      mockWriteFile.mockClear();
      mockMkdir.mockClear();
   });

   afterEach(() => {
      process.env = originalEnv;
   });

   it('writes --file relative names inside the screenshot jail', async () => {
      const jail = path.join(os.tmpdir(), 'tauri-mcp-cli-jail');

      process.env.TAURI_MCP_SCREENSHOT_DIR = jail;

      const written = await writeImageFiles('webview_screenshot', imageContent(), 'shot.png');

      expect(written[0]?.path).toBe(path.resolve(jail, 'shot.png'));
      expect(mockWriteFile).toHaveBeenCalledWith(path.resolve(jail, 'shot.png'), PNG_PIXEL, 'base64');

      const mkdirInsideJail = mockMkdir.mock.calls.every((call) => {
         const target = path.resolve(String(call[0]));

         return target === path.resolve(jail) || target.startsWith(path.resolve(jail) + path.sep);
      });

      expect(mkdirInsideJail).toBe(true);
   });

   it('defaults image output to the screenshot jail when --file is omitted', async () => {
      const jail = path.join(os.tmpdir(), 'tauri-mcp-cli-jail');

      process.env.TAURI_MCP_SCREENSHOT_DIR = jail;

      const written = await writeImageFiles('webview_screenshot', imageContent());

      expect(written[0]?.path.startsWith(path.resolve(jail) + path.sep)).toBe(true);
      expect(written[0]?.path).toMatch(/webview_screenshot-.*\.png$/);
      expect(mockWriteFile).toHaveBeenCalledOnce();
   });

   it('rejects C:\\Windows\\Temp\\..\\evil.png and does not mkdir outside the jail', async () => {
      const jail = path.join(os.tmpdir(), 'tauri-mcp-cli-jail');

      process.env.TAURI_MCP_SCREENSHOT_DIR = jail;

      const writeEscape = writeImageFiles(
         'webview_screenshot',
         imageContent(),
         'C:\\Windows\\Temp\\..\\evil.png'
      );

      await expect(writeEscape).rejects.toThrow(/must stay inside/i);

      expect(mockWriteFile).not.toHaveBeenCalled();

      const mkdirOnlyJail = mockMkdir.mock.calls.every((call) => {
         return path.resolve(String(call[0])) === path.resolve(jail);
      });

      expect(mkdirOnlyJail).toBe(true);
   });

   it('rejects /tmp/evil', async () => {
      const jail = path.join(os.tmpdir(), 'tauri-mcp-cli-jail');

      process.env.TAURI_MCP_SCREENSHOT_DIR = jail;

      await expect(writeImageFiles('webview_screenshot', imageContent(), '/tmp/evil')).rejects.toThrow(
         /must stay inside/i
      );
      expect(mockWriteFile).not.toHaveBeenCalled();
   });

   it('does not mkdir arbitrary parents outside the jail', async () => {
      const jail = path.join(os.tmpdir(), 'tauri-mcp-cli-jail');

      const outside = path.join(os.tmpdir(), `tauri-mcp-should-not-exist-${Date.now()}`, 'evil.png');

      process.env.TAURI_MCP_SCREENSHOT_DIR = jail;

      await expect(writeImageFiles('webview_screenshot', imageContent(), outside)).rejects.toThrow(
         /must stay inside/i
      );
      expect(mockWriteFile).not.toHaveBeenCalled();

      const mkdirOutsideParent = mockMkdir.mock.calls.some((call) => {
         return path.resolve(String(call[0])) === path.resolve(path.dirname(outside));
      });

      expect(mkdirOutsideParent).toBe(false);
   });
});

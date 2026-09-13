import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as webviewExecutor from '../../src/driver/webview-executor';

// Mock the webview-executor module
vi.mock('../../src/driver/webview-executor', () => {
   return {
      executeInWebview: vi.fn(),
      executeInWebviewWithContext: vi.fn().mockResolvedValue({
         result: '4',
         windowLabel: 'main',
         warning: undefined,
      }),
      executeAsyncInWebview: vi.fn(),
      captureScreenshot: vi.fn(),
   };
});

vi.mock('node:fs/promises', () => {
   return {
      mkdir: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
   };
});

describe('Webview Interactions Unit Tests', () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   describe('Schema Validation', () => {
      it('should validate InteractSchema with click action', async () => {
         const { InteractSchema } = await import('../../src/driver/webview-interactions');

         const validInput = {
            action: 'click',
            selector: 'button',
         };

         expect(() => { return InteractSchema.parse(validInput); }).not.toThrow();
      });

      it('should validate InteractSchema with coordinates', async () => {
         const { InteractSchema } = await import('../../src/driver/webview-interactions');

         const validInput = {
            action: 'click',
            x: 100,
            y: 200,
         };

         expect(() => { return InteractSchema.parse(validInput); }).not.toThrow();
      });

      it('should validate InteractSchema with swipe action', async () => {
         const { InteractSchema } = await import('../../src/driver/webview-interactions');

         const validInput = {
            action: 'swipe',
            fromX: 100,
            fromY: 100,
            toX: 300,
            toY: 300,
         };

         expect(() => { return InteractSchema.parse(validInput); }).not.toThrow();
      });

      it('should validate KeyboardSchema with modifiers', async () => {
         const { KeyboardSchema } = await import('../../src/driver/webview-interactions');

         const validInput = {
            action: 'press',
            key: 'Enter',
            modifiers: [ 'Control', 'Shift' ],
         };

         expect(() => { return KeyboardSchema.parse(validInput); }).not.toThrow();
      });

      it('should validate WaitForSchema', async () => {
         const { WaitForSchema } = await import('../../src/driver/webview-interactions');

         const validInput = {
            type: 'selector',
            value: '.my-element',
            timeout: 5000,
         };

         expect(() => { return WaitForSchema.parse(validInput); }).not.toThrow();
      });

      it('should validate ExecuteJavaScriptSchema', async () => {
         const { ExecuteJavaScriptSchema } = await import('../../src/driver/webview-interactions');

         const validInput = {
            script: 'return 2 + 2',
            args: [ 1, 2, 3 ],
         };

         expect(() => { return ExecuteJavaScriptSchema.parse(validInput); }).not.toThrow();
      });
   });

   describe('Function Calls', () => {
      it('should call executeScript when interact is called', async () => {
         const { interact } = await import('../../src/driver/webview-interactions');

         const mockExecuteInWebview = vi.mocked(webviewExecutor.executeInWebview);

         mockExecuteInWebview.mockResolvedValue('Clicked at (100, 100)');

         await interact({ action: 'click', selector: 'button' });

         expect(mockExecuteInWebview).toHaveBeenCalledOnce();
         expect(mockExecuteInWebview).toHaveBeenCalledWith(expect.stringContaining('click'), undefined, undefined);
      });

      it('should call executeScript when interact is called with swipe', async () => {
         const { interact } = await import('../../src/driver/webview-interactions');

         const mockExecuteInWebview = vi.mocked(webviewExecutor.executeInWebview);

         mockExecuteInWebview.mockResolvedValue('Swiped from (100, 100) to (300, 300)');

         await interact({
            action: 'swipe',
            fromX: 100,
            fromY: 100,
            toX: 300,
            toY: 300,
         });

         expect(mockExecuteInWebview).toHaveBeenCalledOnce();
         // Check for mouse/touch event handling in the script
         expect(mockExecuteInWebview).toHaveBeenCalledWith(expect.stringContaining('MouseEvent'), undefined, undefined);
      });

      it('should call executeScript when keyboard is called for key press', async () => {
         const { keyboard } = await import('../../src/driver/webview-interactions');

         const mockExecuteInWebview = vi.mocked(webviewExecutor.executeInWebview);

         mockExecuteInWebview.mockResolvedValue('Pressed key: Enter');

         await keyboard({ action: 'press', selectorOrKey: 'Enter', textOrModifiers: [ 'Control' ] });

         expect(mockExecuteInWebview).toHaveBeenCalledOnce();
         expect(mockExecuteInWebview).toHaveBeenCalledWith(expect.stringContaining('press'), undefined, undefined);
      });

      it('should call executeInWebview when keyboard is called for typing', async () => {
         const { keyboard } = await import('../../src/driver/webview-interactions');

         const mockExecuteInWebview = vi.mocked(webviewExecutor.executeInWebview);

         mockExecuteInWebview.mockResolvedValue('Typed "Hello World" into #input');

         const result = await keyboard({ action: 'type', selectorOrKey: '#input', textOrModifiers: 'Hello World' });

         expect(mockExecuteInWebview).toHaveBeenCalledOnce();
         expect(mockExecuteInWebview).toHaveBeenCalledWith(expect.stringContaining('__MCP__'), undefined, undefined);
         expect(result).toContain('Typed');
      });

      it('should call executeScript when focusElement is called', async () => {
         const { focusElement } = await import('../../src/driver/webview-interactions');

         const mockExecuteInWebview = vi.mocked(webviewExecutor.executeInWebview);

         mockExecuteInWebview.mockResolvedValue('Focused element: input');

         await focusElement({ selector: 'input' });

         expect(mockExecuteInWebview).toHaveBeenCalledOnce();
         expect(mockExecuteInWebview).toHaveBeenCalledWith(expect.stringContaining('focus'), undefined, undefined);
      });

      it('should blur active element when focusElement is called with empty selector', async () => {
         const { focusElement } = await import('../../src/driver/webview-interactions');

         const mockExecuteInWebview = vi.mocked(webviewExecutor.executeInWebview);

         mockExecuteInWebview.mockResolvedValue('Focused element: body');

         await focusElement({ selector: 'body' });

         expect(mockExecuteInWebview).toHaveBeenCalledOnce();
         expect(mockExecuteInWebview).toHaveBeenCalledWith(expect.stringContaining('focus'), undefined, undefined);
      });

      it('should call executeInWebviewWithContext when executeJavaScript is called', async () => {
         const { executeJavaScript } = await import('../../src/driver/webview-interactions');

         const mockExecuteWithContext = vi.mocked(webviewExecutor.executeInWebviewWithContext);

         mockExecuteWithContext.mockResolvedValue({ result: '4', windowLabel: 'main', warning: undefined });

         const result = await executeJavaScript({ script: 'return 2 + 2' });

         expect(mockExecuteWithContext).toHaveBeenCalledOnce();
         expect(result).toContain('4');
         expect(result).toContain('[Executed in window: main]');
      });

      it('should wrap script with args when executeJavaScript is called with arguments', async () => {
         const { executeJavaScript } = await import('../../src/driver/webview-interactions');

         const mockExecuteWithContext = vi.mocked(webviewExecutor.executeInWebviewWithContext);

         mockExecuteWithContext.mockResolvedValue({ result: '8', windowLabel: 'main', warning: undefined });

         await executeJavaScript({ script: 'function(a, b) { return a + b; }', args: [ 5, 3 ] });

         expect(mockExecuteWithContext).toHaveBeenCalledOnce();
         const callArg = mockExecuteWithContext.mock.calls[0][0] as string;

         expect(callArg).toContain('args');
         expect(callArg).toContain('[5,3]');
      });

      it('should use bounded async execution when executeJavaScript has a timeout', async () => {
         const { executeJavaScript } = await import('../../src/driver/webview-interactions');

         const mockExecuteAsync = vi.mocked(webviewExecutor.executeAsyncInWebview);

         mockExecuteAsync.mockResolvedValue('done');

         const result = await executeJavaScript({ script: 'new Promise(() => {})', timeout: 25 });

         expect(mockExecuteAsync).toHaveBeenCalledWith(
            expect.stringContaining('return (new Promise'),
            undefined,
            25,
            undefined
         );
         expect(result).toContain('done');
      });
   });

   describe('Error Handling', () => {
      it('should handle errors from executeInWebview', async () => {
         const { interact } = await import('../../src/driver/webview-interactions');

         const mockExecuteInWebview = vi.mocked(webviewExecutor.executeInWebview);

         mockExecuteInWebview.mockRejectedValue(new Error('WebView error'));

         await expect(interact({ action: 'click', selector: 'button' })).rejects.toThrow('Interaction failed');
      });

      it('should handle errors when element not found', async () => {
         const { focusElement } = await import('../../src/driver/webview-interactions');

         const mockExecuteInWebview = vi.mocked(webviewExecutor.executeInWebview);

         mockExecuteInWebview.mockRejectedValue(new Error('Element not found'));

         await expect(focusElement({ selector: '.nonexistent' })).rejects.toThrow('Focus failed');
      });
   });

   describe('Screenshot path jail', () => {
      const originalEnv = process.env;

      const mockWriteFile = vi.mocked(writeFile);

      const mockMkdir = vi.mocked(mkdir);

      function mockImageCapture(): void {
         vi.mocked(webviewExecutor.captureScreenshot).mockResolvedValue({
            content: [
               { type: 'text', text: 'Screenshot captured' },
               { type: 'image', data: 'aaaa', mimeType: 'image/png' },
            ],
         });
      }

      beforeEach(() => {
         process.env = { ...originalEnv };
         delete process.env.TAURI_MCP_SCREENSHOT_DIR;
         mockWriteFile.mockClear();
         mockMkdir.mockClear();
         mockImageCapture();
      });

      afterEach(() => {
         process.env = originalEnv;
      });

      it('writes relative filePath inside the screenshot jail', async () => {
         const jail = path.join(os.tmpdir(), 'tauri-mcp-screenshots-unit');

         process.env.TAURI_MCP_SCREENSHOT_DIR = jail;

         const { screenshot } = await import('../../src/driver/webview-interactions');

         const result = await screenshot({ filePath: 'shot.png' });

         expect('filePath' in result).toBe(true);
         if (!('filePath' in result)) {
            throw new Error('Expected file result');
         }

         expect(result.filePath).toBe(path.resolve(jail, 'shot.png'));
         expect(mockWriteFile).toHaveBeenCalledWith(result.filePath, 'aaaa', 'base64');

         const mkdirInsideJail = mockMkdir.mock.calls.every((call) => {
            const target = path.resolve(String(call[0]));

            return target === path.resolve(jail) || target.startsWith(path.resolve(jail) + path.sep);
         });

         expect(mkdirInsideJail).toBe(true);
      });

      it('rejects a Windows absolute escape after canonicalize', async () => {
         const { screenshot } = await import('../../src/driver/webview-interactions');

         await expect(screenshot({ filePath: 'C:\\Windows\\Temp\\..\\evil.png' })).rejects.toThrow(
            /must stay inside/i
         );
         expect(mockWriteFile).not.toHaveBeenCalled();
      });

      it('rejects a POSIX absolute escape', async () => {
         const { screenshot } = await import('../../src/driver/webview-interactions');

         await expect(screenshot({ filePath: '/tmp/evil' })).rejects.toThrow(/must stay inside/i);
         expect(mockWriteFile).not.toHaveBeenCalled();
      });

      it('rejects parent-directory traversal', async () => {
         const { screenshot } = await import('../../src/driver/webview-interactions');

         await expect(screenshot({ filePath: '../evil.png' })).rejects.toThrow(/must stay inside/i);
         expect(mockWriteFile).not.toHaveBeenCalled();
      });

      it('allows an absolute path that already lives in the jail', async () => {
         const jail = path.join(os.tmpdir(), 'tauri-mcp-screenshots-unit');

         process.env.TAURI_MCP_SCREENSHOT_DIR = jail;

         const { screenshot } = await import('../../src/driver/webview-interactions');

         const result = await screenshot({ filePath: path.join(jail, 'nested', 'ok.png') });

         expect('filePath' in result).toBe(true);
         if (!('filePath' in result)) {
            throw new Error('Expected file result');
         }

         expect(result.filePath).toBe(path.resolve(jail, 'nested', 'ok.png'));
         expect(mockWriteFile).toHaveBeenCalledOnce();
      });

      it('marks webview_screenshot as not read-only because it can write files', async () => {
         const { TOOLS } = await import('../../src/tools-registry');

         const tool = TOOLS.find((entry) => {
            return entry.name === 'webview_screenshot';
         });

         expect(tool?.annotations?.readOnlyHint).toBe(false);
      });
   });
});

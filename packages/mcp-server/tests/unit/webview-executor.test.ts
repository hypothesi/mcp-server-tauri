import { runInNewContext } from 'node:vm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSendCommand = vi.fn();

const mockConnect = vi.fn();

const mockIsConnected = vi.fn(() => { return true; });

const mockRegisterScript = vi.fn();

const mockIsScriptRegistered = vi.fn();

const mockHasActiveSession = vi.fn(() => { return true; });

const mockResolveTargetApp = vi.fn();

vi.mock('../../src/driver/script-manager.js', () => {
   return {
      registerScript: mockRegisterScript,
      isScriptRegistered: mockIsScriptRegistered,
   };
});

vi.mock('../../src/driver/session-manager.js', () => {
   return {
      hasActiveSession: mockHasActiveSession,
      resolveTargetApp: mockResolveTargetApp,
   };
});

vi.mock('../../src/logger.js', () => {
   return {
      createMcpLogger: () => {
         return {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
         };
      },
   };
});

function createSession(): {
   host: string;
   port: number;
   client: {
      connect: typeof mockConnect;
      isConnected: typeof mockIsConnected;
      sendCommand: typeof mockSendCommand;
   };
} {
   return {
      host: 'localhost',
      port: 9300,
      client: {
         connect: mockConnect,
         isConnected: mockIsConnected,
         sendCommand: mockSendCommand,
      },
   };
}

describe('Webview Executor Unit Tests', () => {
   beforeEach(() => {
      vi.resetModules();
      vi.clearAllMocks();
      mockHasActiveSession.mockReturnValue(true);
      mockResolveTargetApp.mockReturnValue(createSession());
      mockIsConnected.mockReturnValue(true);
      mockConnect.mockResolvedValue(undefined);
      mockRegisterScript.mockResolvedValue({ registered: true, scriptId: 'test-script' });
      mockIsScriptRegistered.mockResolvedValue(false);
   });

   it('registers the resolve-ref helper in the requested window during initialization', async () => {
      const executor = await import('../../src/driver/webview-executor.js');

      executor.resetInitialization();

      mockSendCommand
         .mockResolvedValueOnce({
            success: true,
            data: true,
         })
         .mockResolvedValueOnce({
            success: true,
            data: 'test-app',
            windowContext: { windowLabel: 'recording-toolbar' },
         });

      const result = await executor.executeInWebviewWithContext('document.title', 'recording-toolbar', 9300);

      expect(mockRegisterScript).toHaveBeenCalledWith(
         '__mcp_resolve_ref__',
         'inline',
         expect.any(String),
         'recording-toolbar',
         9300
      );
      expect(mockSendCommand).toHaveBeenNthCalledWith(1, {
         command: 'execute_js',
         args: {
            script: 'return !!(window.__MCP__ && typeof window.__MCP__.resolveRef === "function")',
            windowLabel: 'recording-toolbar',
         },
      }, 2000);
      expect(mockSendCommand).toHaveBeenNthCalledWith(2, {
         command: 'execute_js',
         args: { script: 'document.title', windowLabel: 'recording-toolbar' },
      }, 7000);
      expect(result).toEqual({
         result: 'test-app',
         windowLabel: 'recording-toolbar',
         warning: undefined,
      });
   });

   it('keeps the requested window for html2canvas fallback screenshots', async () => {
      const executor = await import('../../src/driver/webview-executor.js');

      executor.resetInitialization();

      mockSendCommand
         .mockResolvedValueOnce({
            success: true,
            data: true,
         })
         .mockResolvedValueOnce({
            success: false,
            error: 'Native screenshot unavailable',
         })
         .mockResolvedValueOnce({
            success: true,
            data: 'data:image/png;base64,ZmFrZQ==',
            windowContext: { windowLabel: 'recording-toolbar' },
         });

      const result = await executor.captureScreenshot({
         windowId: 'recording-toolbar',
         appIdentifier: 9300,
      });

      expect(mockRegisterScript).toHaveBeenCalledWith(
         '__mcp_html2canvas__',
         'inline',
         expect.any(String),
         'recording-toolbar',
         9300
      );
      expect(mockSendCommand).toHaveBeenNthCalledWith(1, expect.objectContaining({
         command: 'execute_js',
         args: expect.objectContaining({ script: expect.stringContaining('resolveRef') }),
      }), 2000);
      expect(mockSendCommand).toHaveBeenNthCalledWith(2, expect.objectContaining({
         command: 'capture_native_screenshot',
         args: expect.objectContaining({ windowLabel: 'recording-toolbar' }),
      }), 15000);
      expect(mockSendCommand).toHaveBeenNthCalledWith(3, expect.objectContaining({
         command: 'execute_js',
         args: expect.objectContaining({ windowLabel: 'recording-toolbar' }),
      }), 12000);
      expect(result.content[0]).toEqual({
         type: 'text',
         text: 'Screenshot captured via html2canvas',
      });
      expect(result.content[1]).toEqual({
         type: 'image',
         data: 'ZmFrZQ==',
         mimeType: 'image/png',
      });
   });

   it('does not request screen-sharing permission without explicit opt-in', async () => {
      const executor = await import('../../src/driver/webview-executor.js');

      executor.resetInitialization();

      mockSendCommand
         .mockResolvedValueOnce({ success: true, data: true })
         .mockResolvedValueOnce({ success: false, error: 'Native screenshot unavailable on Linux' })
         .mockResolvedValueOnce({ success: false, error: 'Script execution timeout' });

      await expect(executor.captureScreenshot()).rejects.toThrow(
         'Screen Capture API fallback is disabled'
      );

      expect(mockSendCommand).toHaveBeenCalledTimes(3);

      const scripts = mockSendCommand.mock.calls
         .map(([ command ]) => { return command.args?.script; })
         .filter((script): script is string => { return typeof script === 'string'; });

      expect(scripts.every((script) => { return !script.includes('getDisplayMedia'); })).toBe(true);
   });

   it('uses Screen Capture API only after explicit opt-in', async () => {
      const executor = await import('../../src/driver/webview-executor.js');

      executor.resetInitialization();

      mockSendCommand
         .mockResolvedValueOnce({ success: true, data: true })
         .mockResolvedValueOnce({ success: false, error: 'Native screenshot unavailable on Linux' })
         .mockResolvedValueOnce({ success: false, error: 'html2canvas failed' })
         .mockResolvedValueOnce({ success: true, data: 'data:image/png;base64,ZmFrZQ==' });

      const result = await executor.captureScreenshot({ format: 'png', allowScreenCapture: true });

      expect(mockSendCommand).toHaveBeenCalledTimes(4);
      expect(mockSendCommand).toHaveBeenLastCalledWith(expect.objectContaining({
         command: 'execute_js',
         args: expect.objectContaining({ script: expect.stringContaining('getDisplayMedia') }),
      }), 7000);
      expect(result.content[0]).toEqual({
         type: 'text',
         text: 'Screenshot captured via Screen Capture API',
      });
   });

   describe('getConsoleLogs JS encoding', () => {
      const concatPayload = '\'+(pwned=true)+\'';

      const commentPayload = '\';pwned=true;//';

      const filterBackslashPayload = '\\\';pwned=true;//';

      const filterPayloads = [ concatPayload, commentPayload, filterBackslashPayload ];

      async function captureConsoleLogsScript(options: { filter?: string; since?: string; level?: string }): Promise<string> {
         const executor = await import('../../src/driver/webview-executor.js');

         executor.resetInitialization();
         mockSendCommand
            .mockResolvedValueOnce({ success: true, data: true })
            .mockResolvedValueOnce({ success: true, data: 'ok' });

         await executor.getConsoleLogs(options);

         const scripts = mockSendCommand.mock.calls
            .map(([ command ]) => { return command.args?.script; })
            .filter((script): script is string => {
               return typeof script === 'string' && script.includes('__MCP_CONSOLE_LOGS__');
            });

         expect(scripts).toHaveLength(1);

         return scripts[0];
      }

      function evalConsoleLogsScript(script: string, logs: Array<{ level: string; message: string; timestamp: number }> = []): {
         pwned: boolean;
         result: unknown;
         error?: string;
      } {
         const sandbox = {
            pwned: false,
            window: { __MCP_CONSOLE_LOGS__: logs },
         };

         try {
            return {
               pwned: sandbox.pwned,
               result: runInNewContext(`(function() { ${script} })()`, sandbox, { timeout: 500 }),
            };
         } catch(error: unknown) {
            return {
               pwned: sandbox.pwned,
               result: undefined,
               error: error instanceof Error ? error.message : String(error),
            };
         }
      }

      it('still filters logs for a benign since value', async () => {
         const script = await captureConsoleLogsScript({ since: '2023-10-27T10:00:00Z' });

         const replica = evalConsoleLogsScript(script, [
            { level: 'info', message: 'old', timestamp: Date.parse('2020-01-01T00:00:00Z') },
            { level: 'info', message: 'new', timestamp: Date.parse('2024-01-01T00:00:00Z') },
         ]);

         expect(replica.pwned).toBe(false);
         expect(replica.error).toBeUndefined();
         expect(replica.result).toContain('new');
         expect(replica.result).not.toContain('old');
         expect(script).toContain('const sinceStr = "2023-10-27T10:00:00Z"');
      });

      it.each([ concatPayload, commentPayload ])('does not execute attacker statements from since %j', async (since) => {
         const script = await captureConsoleLogsScript({ since });

         const replica = evalConsoleLogsScript(script);

         expect(replica.pwned).toBe(false);
         expect(script).toContain(`const sinceStr = ${JSON.stringify(since)}`);
         expect(script).not.toContain(`if ('${since}')`);
      });

      it.each(filterPayloads)('does not execute attacker statements from filter %j', async (filter) => {
         const script = await captureConsoleLogsScript({ filter });

         const replica = evalConsoleLogsScript(script, [
            { level: 'info', message: 'hello', timestamp: Date.now() },
         ]);

         expect(replica.pwned).toBe(false);
         expect(script).toContain(`const filterStr = ${JSON.stringify(filter)}`);
         expect(script).not.toContain(`new RegExp('${filter.replace(/'/g, '\\\'')}', 'i')`);
      });
   });
});

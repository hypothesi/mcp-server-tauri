import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendCommand, ensureSessionAndConnect } = vi.hoisted(() => {
   return {
      sendCommand: vi.fn(),
      ensureSessionAndConnect: vi.fn(),
   };
});

vi.mock('../../src/driver/plugin-client', () => {
   return { ensureSessionAndConnect };
});

import {
   interactWithNativeDialog,
   NativeDialogInteractSchema,
   NativeDialogSnapshotSchema,
   snapshotNativeDialog,
} from '../../src/driver/native-dialog';

describe('Native dialog tools', () => {
   beforeEach(() => {
      vi.clearAllMocks();
      ensureSessionAndConnect.mockResolvedValue({ sendCommand });
   });

   it('sends a bounded semantic snapshot request through the active session', async () => {
      sendCommand.mockResolvedValue({
         success: true,
         data: { platform: 'windows', dialogs: [], dialogCount: 0 },
      });

      const result = JSON.parse(await snapshotNativeDialog({
         windowId: 'settings',
         appIdentifier: 9300,
         timeoutMs: 500,
      }));

      expect(result.platform).toBe('windows');
      expect(ensureSessionAndConnect).toHaveBeenCalledWith(9300);
      expect(sendCommand).toHaveBeenCalledWith({
         command: 'native_dialog_snapshot',
         args: {
            windowLabel: 'settings',
            timeoutMs: 500,
            scopeId: expect.any(String),
            minOwnerDepth: 1,
         },
      }, 2000);
   });

   it('does not log or echo a path in an interaction result', async () => {
      const sensitivePath = 'C:\\temporary\\private-fixture.txt',
            logSpy = vi.spyOn(console, 'log').mockImplementation(() => { return undefined; }),
            errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { return undefined; });

      sendCommand.mockResolvedValue({
         success: true,
         data: { action: 'setValue', elementRef: 'native_ref', referencesInvalidated: false },
      });

      const result = await interactWithNativeDialog({
         action: 'setValue',
         elementRef: 'native_ref',
         value: sensitivePath,
         timeoutMs: 500,
      });

      expect(result).not.toContain(sensitivePath);
      expect(logSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
   });

   it('sends multiple absolute file paths without exposing them in the result', async () => {
      const paths = [ 'C:\\temporary\\first.txt', 'C:\\temporary\\second.txt' ];

      sendCommand.mockResolvedValue({
         success: true,
         data: { action: 'setPaths', elementRef: 'native_ref', referencesInvalidated: false },
      });

      const result = await interactWithNativeDialog({
         action: 'setPaths',
         elementRef: 'native_ref',
         paths,
         timeoutMs: 500,
      });

      expect(result).not.toContain(paths[0]);
      expect(result).not.toContain(paths[1]);
      expect(sendCommand).toHaveBeenCalledWith({
         command: 'native_dialog_interact',
         args: {
            action: 'setPaths',
            elementRef: 'native_ref',
            paths,
            scopeId: expect.any(String),
            timeoutMs: 500,
            value: undefined,
            windowLabel: undefined,
         },
      }, 2000);
   });

   it('surfaces stale and unsupported-platform bridge errors clearly', async () => {
      sendCommand.mockResolvedValueOnce({
         success: false,
         error: 'Stale native dialog element reference; take a new native_dialog_snapshot',
      });

      const staleInteraction = interactWithNativeDialog({
         action: 'invoke',
         elementRef: 'expired',
         timeoutMs: 500,
      });

      await expect(staleInteraction)
         .rejects
         .toThrow('Stale native dialog element reference');

      sendCommand.mockResolvedValueOnce({
         success: false,
         error: 'Native dialog automation is only supported on Windows with an interactive desktop',
      });

      await expect(snapshotNativeDialog({ timeoutMs: 500 }))
         .rejects
         .toThrow('only supported on Windows');
   });

   it('rejects unbounded timeouts and missing setValue data', () => {
      function parseMissingValue(): unknown {
         return NativeDialogInteractSchema.parse({ action: 'setValue', elementRef: 'native_ref' });
      }

      function parseMissingPaths(): unknown {
         return NativeDialogInteractSchema.parse({
            action: 'setPaths',
            elementRef: 'native_ref',
            paths: [],
         });
      }

      expect(() => { return NativeDialogSnapshotSchema.parse({ timeoutMs: 10001 }); })
         .toThrow();

      expect(parseMissingValue).toThrow();
      expect(parseMissingPaths).toThrow();
   });
});

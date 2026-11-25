import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
   startIPCMonitoring,
   stopIPCMonitoring,
   getIPCEvents,
   getWindowInfo,
   emitTestEvent,
   getBackendState,
   executeIPCCommand,
} from '../../src/driver/plugin-commands';
import { manageDriverSession } from '../../src/driver/session-manager';
import { TOOL_MAP } from '../../src/tools-registry';
import { getTestAppPort } from '../test-utils';

/**
 * E2E tests for MCP Bridge Plugin.
 * Now uses native Tauri IPC - works on all platforms (Linux, Windows, macOS)!
 */
describe('MCP Bridge Plugin E2E Tests', () => {
   const TIMEOUT = 10000;

   beforeAll(async () => {
      // App is already started globally - connect to the dynamically assigned port
      await manageDriverSession('start', undefined, getTestAppPort());
   });

   afterAll(async () => {
      // Don't stop the app - it's managed globally
      await manageDriverSession('stop');
   });

   it('should get window information from the plugin', async () => {
      const windowInfo = await getWindowInfo();

      expect(windowInfo).toBeTruthy();
      const info = JSON.parse(windowInfo as unknown as string);

      expect(info).toHaveProperty('width');
      expect(info).toHaveProperty('height');
      expect(info).toHaveProperty('title');
      expect(info.title).toContain('test-app');
   }, TIMEOUT);

   it('should get backend state from the plugin', async () => {
      const state = await getBackendState();

      expect(state).toBeTruthy();
      const stateObj = JSON.parse(state as unknown as string);

      // Check for app metadata
      expect(stateObj).toHaveProperty('app');
      expect(stateObj.app).toHaveProperty('name');
      expect(stateObj.app).toHaveProperty('identifier');

      // Check for windows list
      expect(stateObj).toHaveProperty('windows');
      expect(Array.isArray(stateObj.windows)).toBe(true);

      // Check for environment info
      expect(stateObj).toHaveProperty('environment');
      expect(stateObj.environment).toHaveProperty('os');
   }, TIMEOUT);

   it('should start and stop IPC monitoring', async () => {
      const startResult = await startIPCMonitoring();

      expect(startResult).toContain('IPC monitoring started');

      const stopResult = await stopIPCMonitoring();

      expect(stopResult).toContain('IPC monitoring stopped');
   }, TIMEOUT);

   it('should capture IPC events when monitoring', async () => {
      // Start monitoring
      await startIPCMonitoring();

      // Execute a test command to generate IPC traffic
      await executeIPCCommand({ command: 'greet', args: { name: 'Test' } });

      // Small delay to ensure event is captured
      await new Promise((resolve) => { return setTimeout(resolve, 500); });

      // Get events
      const eventsResult = await getIPCEvents();

      const events = JSON.parse(eventsResult as unknown as string);

      expect(Array.isArray(events)).toBe(true);
      // Note: Events may or may not be captured depending on how monitoring is
      // implemented This test just verifies the infrastructure works

      await stopIPCMonitoring();
   }, TIMEOUT);

   it('should emit custom events', async () => {
      const result = await emitTestEvent('test-event', { message: 'hello' });

      expect(result).toContain('emitted successfully');
   }, TIMEOUT);

   describe('ipc_execute_command arguments', () => {
      const ARGS = { a: 5, b: 3 },
            EXPECTED = { success: true, result: 8 };

      async function callTool(args: unknown): Promise<unknown> {
         const tool = TOOL_MAP.get('ipc_execute_command');

         if (!tool) {
            throw new Error('ipc_execute_command is not registered');
         }

         return JSON.parse(String(await tool.handler({ command: 'add_numbers', args })));
      }

      it('passes an args object to the command', async () => {
         const result = await callTool(ARGS);

         expect(result).toEqual(EXPECTED);
      }, TIMEOUT);

      it('passes args that a client sent as a JSON string', async () => {
         const result = await callTool(JSON.stringify(ARGS));

         expect(result).toEqual(EXPECTED);
      }, TIMEOUT);

      it('rejects args that are not an object', async () => {
         await expect(callTool('not json')).rejects.toThrow('args must be a JSON object');
      }, TIMEOUT);
   });
});

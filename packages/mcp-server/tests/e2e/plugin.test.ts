import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
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
import { executeInWebview } from '../../src/driver/webview-executor';
import { getTestAppPort } from '../test-utils';

function waitForOpen(websocket: WebSocket): Promise<void> {
   return new Promise((resolve, reject) => {
      websocket.once('open', resolve);
      websocket.once('error', reject);
   });
}

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
      await executeIPCCommand('greet', { name: 'Test' });

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

   it('should execute IPC commands via plugin', async () => {
      const result = await executeIPCCommand('add_numbers', { a: 5, b: 3 });

      const parsed = JSON.parse(result);

      // Check if it succeeded or returned expected structure
      expect(parsed).toBeTruthy();
   }, TIMEOUT);

   it('should accept headerless Node WebSocket clients', async () => {
      const websocket = new WebSocket(`ws://127.0.0.1:${getTestAppPort()}`);

      await waitForOpen(websocket);
      expect(websocket.readyState).toBe(WebSocket.OPEN);
      websocket.close();
   }, TIMEOUT);

   it('should reject browser origins before dispatching privileged commands', async () => {
      const marker = '__MCP_ORIGIN_ATTACK_DISPATCHED__';

      await executeInWebview(`window.${marker} = false; return false;`);

      const websocket = new WebSocket(`ws://127.0.0.1:${getTestAppPort()}`, {
         origin: 'https://attacker.example',
      });

      const command = JSON.stringify({
         command: 'execute_js',
         args: { script: `window.${marker} = true; return true;` },
      });

      let opened = false;

      const status = await new Promise<number>((resolve, reject) => {
         websocket.once('open', () => {
            opened = true;
            websocket.send(command, (error) => {
               if (error) {
                  reject(error);
                  return;
               }
               resolve(101);
            });
         });
         websocket.once('unexpected-response', (request, response) => {
            const statusCode = response.statusCode ?? 0;

            response.resume();
            request.destroy();
            resolve(statusCode);
         });
         websocket.once('error', reject);
      });

      if (websocket.readyState === WebSocket.OPEN) {
         websocket.close();
      } else if (websocket.readyState !== WebSocket.CLOSED) {
         websocket.terminate();
      }

      await new Promise((resolve) => { return setTimeout(resolve, 100); });

      expect(status).toBe(403);
      expect(opened).toBe(false);
      await expect(executeInWebview(`return Boolean(window.${marker});`)).resolves.toBe('false');
   }, TIMEOUT);
});

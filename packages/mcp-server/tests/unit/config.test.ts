import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { getCwdHint, getDefaultHost, getDefaultPort, getConfig, buildWebSocketURL } from '../../src/config.js';

describe('config', () => {
   const originalEnv = process.env;

   beforeEach(() => {
      // Reset environment before each test
      vi.resetModules();
      process.env = { ...originalEnv };
      delete process.env.MCP_BRIDGE_HOST;
      delete process.env.MCP_BRIDGE_PORT;
      delete process.env.MCP_BRIDGE_CWD;
      delete process.env.TAURI_DEV_HOST;
   });

   afterEach(() => {
      process.env = originalEnv;
   });

   describe('getDefaultHost', () => {
      it('returns localhost by default', () => {
         expect(getDefaultHost()).toBe('localhost');
      });

      it('returns MCP_BRIDGE_HOST when set', () => {
         process.env.MCP_BRIDGE_HOST = '192.168.1.100';

         // Need to re-import to pick up env change
         expect(getDefaultHost()).toBe('192.168.1.100');
      });

      it('returns TAURI_DEV_HOST when MCP_BRIDGE_HOST not set', () => {
         process.env.TAURI_DEV_HOST = '10.0.0.50';

         expect(getDefaultHost()).toBe('10.0.0.50');
      });

      it('prefers MCP_BRIDGE_HOST over TAURI_DEV_HOST', () => {
         process.env.MCP_BRIDGE_HOST = '192.168.1.100';
         process.env.TAURI_DEV_HOST = '10.0.0.50';

         expect(getDefaultHost()).toBe('192.168.1.100');
      });
   });

   describe('getDefaultPort', () => {
      it('returns 9223 by default', () => {
         expect(getDefaultPort()).toBe(9223);
      });

      it('returns MCP_BRIDGE_PORT when set', () => {
         process.env.MCP_BRIDGE_PORT = '9225';

         expect(getDefaultPort()).toBe(9225);
      });

      it('handles invalid port gracefully', () => {
         process.env.MCP_BRIDGE_PORT = 'invalid';

         expect(getDefaultPort()).toBeNaN();
      });
   });

   describe('getConfig', () => {
      it('returns default config', () => {
         const config = getConfig();

         expect(config.host).toBe('localhost');
         expect(config.port).toBe(9223);
      });

      it('returns config from environment', () => {
         process.env.MCP_BRIDGE_HOST = '192.168.1.100';
         process.env.MCP_BRIDGE_PORT = '9225';

         const config = getConfig();

         expect(config.host).toBe('192.168.1.100');
         expect(config.port).toBe(9225);
      });
   });

   describe('buildWebSocketURL', () => {
      it('builds correct URL for localhost', () => {
         expect(buildWebSocketURL('localhost', 9223)).toBe('ws://localhost:9223');
      });

      it('builds correct URL for IP address', () => {
         expect(buildWebSocketURL('192.168.1.100', 9225)).toBe('ws://192.168.1.100:9225');
      });

      it('builds correct URL for 0.0.0.0', () => {
         expect(buildWebSocketURL('0.0.0.0', 9223)).toBe('ws://0.0.0.0:9223');
      });
   });

   describe('getCwdHint', () => {
      it('returns process.cwd() when no env var is set', () => {
         expect(getCwdHint()).toBe(process.cwd());
      });

      it('returns MCP_BRIDGE_CWD when set', () => {
         process.env.MCP_BRIDGE_CWD = '/some/worktree/path';

         expect(getCwdHint()).toBe('/some/worktree/path');
      });

      it('ignores an empty MCP_BRIDGE_CWD and falls back to process.cwd()', () => {
         process.env.MCP_BRIDGE_CWD = '';

         expect(getCwdHint()).toBe(process.cwd());
      });
   });
});

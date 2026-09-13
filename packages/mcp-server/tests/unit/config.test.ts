import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
   buildWebSocketURL,
   canonicalizeHost,
   getBridgeToken,
   getBridgeTokenFilePath,
   getCwdHint,
   getConfig,
   getDefaultHost,
   getDefaultPort,
   getWebSocketClientHeaders,
   isAllowedBridgeHost,
   isLoopbackHost,
   MCP_BRIDGE_TOKEN_FILE_NAME,
   MCP_BRIDGE_TOKEN_HEADER,
} from '../../src/config.js';

describe('config', () => {
   const originalEnv = process.env;

   beforeEach(() => {
      // Reset environment before each test
      vi.resetModules();
      process.env = { ...originalEnv };
      delete process.env.MCP_BRIDGE_HOST;
      delete process.env.MCP_BRIDGE_PORT;
      delete process.env.MCP_BRIDGE_CWD;
      delete process.env.MCP_BRIDGE_TOKEN;
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

   describe('getBridgeToken', () => {
      it('returns null by default', () => {
         expect(getBridgeToken()).toBeNull();
         expect(getWebSocketClientHeaders()).toBeUndefined();
      });

      it('returns MCP_BRIDGE_TOKEN and the upgrade header when set', () => {
         process.env.MCP_BRIDGE_TOKEN = 'secret-token';

         expect(getBridgeToken()).toBe('secret-token');
         expect(MCP_BRIDGE_TOKEN_HEADER).toBe('X-MCP-Bridge-Token');
         expect(getWebSocketClientHeaders()).toEqual({
            [MCP_BRIDGE_TOKEN_HEADER]: 'secret-token',
         });
      });

      it('ignores an empty MCP_BRIDGE_TOKEN', () => {
         process.env.MCP_BRIDGE_TOKEN = '';

         expect(getBridgeToken()).toBeNull();
      });
   });

   describe('getBridgeToken token-file fallback', () => {
      let tokenDir: string;

      beforeEach(() => {
         tokenDir = mkdtempSync(join(tmpdir(), 'mcp-bridge-token-'));
         process.env.MCP_BRIDGE_TOKEN_FILE = join(tokenDir, 'hypothesi-mcp-bridge.token');
      });

      afterEach(() => {
         rmSync(tokenDir, { recursive: true, force: true });
      });

      it('defaults the file path to the plugin location under os.tmpdir()', () => {
         delete process.env.MCP_BRIDGE_TOKEN_FILE;

         expect(getBridgeTokenFilePath()).toBe(join(tmpdir(), MCP_BRIDGE_TOKEN_FILE_NAME));
         expect(MCP_BRIDGE_TOKEN_FILE_NAME).toBe('hypothesi-mcp-bridge.token');
      });

      it('honours MCP_BRIDGE_TOKEN_FILE as the file path', () => {
         expect(getBridgeTokenFilePath()).toBe(join(tokenDir, 'hypothesi-mcp-bridge.token'));
      });

      it('returns null when the token file is missing', () => {
         expect(getBridgeToken()).toBeNull();
         expect(getBridgeToken('127.0.0.1')).toBeNull();
      });

      it('reads a trimmed token from the file for loopback targets', () => {
         writeFileSync(getBridgeTokenFilePath(), '  file-token\n');

         expect(getBridgeToken()).toBe('file-token');
         expect(getBridgeToken('localhost')).toBe('file-token');
         expect(getBridgeToken('127.0.0.1')).toBe('file-token');
         expect(getBridgeToken('[::1]')).toBe('file-token');
         expect(getWebSocketClientHeaders('127.0.0.1')).toEqual({
            [MCP_BRIDGE_TOKEN_HEADER]: 'file-token',
         });
      });

      it('never presents the file token to a non-loopback host', () => {
         writeFileSync(getBridgeTokenFilePath(), 'file-token');

         expect(getBridgeToken('192.168.1.9')).toBeNull();
         expect(getBridgeToken('203.0.113.5')).toBeNull();
         expect(getWebSocketClientHeaders('192.168.1.9')).toBeUndefined();

         process.env.MCP_BRIDGE_HOST = '192.168.1.9';

         expect(getBridgeToken()).toBeNull();
      });

      it('prefers MCP_BRIDGE_TOKEN over the file, including for non-loopback hosts', () => {
         writeFileSync(getBridgeTokenFilePath(), 'file-token');
         process.env.MCP_BRIDGE_TOKEN = 'env-token';

         expect(getBridgeToken()).toBe('env-token');
         expect(getBridgeToken('192.168.1.9')).toBe('env-token');
      });

      it('treats a blank token file as no token', () => {
         writeFileSync(getBridgeTokenFilePath(), ' \n');

         expect(getBridgeToken()).toBeNull();
      });
   });

   describe('isLoopbackHost / isAllowedBridgeHost', () => {
      it('treats localhost and loopback addresses as loopback', () => {
         expect(isLoopbackHost('localhost')).toBe(true);
         expect(isLoopbackHost('127.0.0.1')).toBe(true);
         expect(isLoopbackHost('127.0.0.2')).toBe(true);
         expect(isLoopbackHost('::1')).toBe(true);
         expect(isLoopbackHost('[::1]')).toBe(true);
         expect(isLoopbackHost('::ffff:127.0.0.1')).toBe(true);
      });

      it('does not treat LAN or public hosts as loopback', () => {
         expect(isLoopbackHost('192.168.1.9')).toBe(false);
         expect(isLoopbackHost('10.0.0.5')).toBe(false);
         expect(isLoopbackHost('203.0.113.5')).toBe(false);
         expect(canonicalizeHost('192.168.1.9')).toBe('192.168.1.9');
      });

      it('allowlists loopback even without env configuration', () => {
         expect(isAllowedBridgeHost('127.0.0.1')).toBe(true);
         expect(isAllowedBridgeHost('localhost')).toBe(true);
      });

      it('allowlists MCP_BRIDGE_HOST and TAURI_DEV_HOST', () => {
         process.env.MCP_BRIDGE_HOST = '192.168.1.9';

         expect(isAllowedBridgeHost('192.168.1.9')).toBe(true);
         expect(isAllowedBridgeHost('10.0.0.5')).toBe(false);

         delete process.env.MCP_BRIDGE_HOST;
         process.env.TAURI_DEV_HOST = '10.0.0.5';

         expect(isAllowedBridgeHost('10.0.0.5')).toBe(true);
      });

      it('allowlists an explicitly passed operator host and rejects arbitrary peers', () => {
         expect(isAllowedBridgeHost('203.0.113.5')).toBe(false);
         expect(isAllowedBridgeHost('203.0.113.5', '203.0.113.5')).toBe(true);
         expect(isAllowedBridgeHost('203.0.113.5', '192.168.1.9')).toBe(false);
      });
   });
});

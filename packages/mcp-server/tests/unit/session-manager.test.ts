import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Session Manager Unit Tests', () => {
   const originalEnv = process.env;

   beforeEach(() => {
      vi.resetModules();
      vi.clearAllMocks();
      process.env = { ...originalEnv };
      delete process.env.MCP_BRIDGE_HOST;
      delete process.env.MCP_BRIDGE_PORT;
      delete process.env.TAURI_DEV_HOST;
   });

   afterEach(() => {
      process.env = originalEnv;
   });

   describe('ManageDriverSessionSchema', () => {
      it('should validate action: start', async () => {
         const { ManageDriverSessionSchema } = await import('../../src/driver/session-manager');

         const result = ManageDriverSessionSchema.parse({ action: 'start' });

         expect(result.action).toBe('start');
      });

      it('should validate action: stop', async () => {
         const { ManageDriverSessionSchema } = await import('../../src/driver/session-manager');

         const result = ManageDriverSessionSchema.parse({ action: 'stop' });

         expect(result.action).toBe('stop');
      });

      it('should accept optional host parameter', async () => {
         const { ManageDriverSessionSchema } = await import('../../src/driver/session-manager');

         const result = ManageDriverSessionSchema.parse({
            action: 'start',
            host: '192.168.1.100',
         });

         expect(result.host).toBe('192.168.1.100');
      });

      it('should accept optional port parameter', async () => {
         const { ManageDriverSessionSchema } = await import('../../src/driver/session-manager');

         const result = ManageDriverSessionSchema.parse({
            action: 'start',
            port: 9225,
         });

         expect(result.port).toBe(9225);
      });

      it('should accept both host and port parameters', async () => {
         const { ManageDriverSessionSchema } = await import('../../src/driver/session-manager');

         const result = ManageDriverSessionSchema.parse({
            action: 'start',
            host: '10.0.0.50',
            port: 9300,
         });

         expect(result.host).toBe('10.0.0.50');
         expect(result.port).toBe(9300);
      });

      it('should reject invalid action', async () => {
         const { ManageDriverSessionSchema } = await import('../../src/driver/session-manager');

         expect(() => { return ManageDriverSessionSchema.parse({ action: 'invalid' }); }).toThrow();
      });

      it('should have correct description for host parameter', async () => {
         const { ManageDriverSessionSchema } = await import('../../src/driver/session-manager');

         const hostField = ManageDriverSessionSchema.shape.host;

         expect(hostField.description).toContain('Host address');
         expect(hostField.description).toContain('MCP_BRIDGE_HOST');
         expect(hostField.description).toContain('TAURI_DEV_HOST');
      });

      it('should have correct description for port parameter', async () => {
         const { ManageDriverSessionSchema } = await import('../../src/driver/session-manager');

         const portField = ManageDriverSessionSchema.shape.port;

         expect(portField.description).toContain('Port');
         expect(portField.description).toContain('9223');
      });
   });

   describe('findSessionByCwd', () => {
      // Build a minimal SessionInfo from just the cwd + port fields findSessionByCwd reads.
      // The other fields are present in the type but never inspected by this function.
      function fakeSession(port: number, cwd: string | null): unknown {
         return { name: `app-${port}`, identifier: null, cwd, host: 'localhost', port, client: null, connected: true };
      }

      it('returns null when hintCwd is null', async () => {
         const { findSessionByCwd } = await import('../../src/driver/session-manager');

         const sessions = [ fakeSession(9223, '/Users/me/proj') ];

         expect(findSessionByCwd(sessions as never, null)).toBeNull();
      });

      it('returns null when no session has a cwd', async () => {
         const { findSessionByCwd } = await import('../../src/driver/session-manager');

         const sessions = [ fakeSession(9223, null), fakeSession(9224, null) ];

         expect(findSessionByCwd(sessions as never, '/Users/me/proj')).toBeNull();
      });

      it('matches an exact-equal session CWD', async () => {
         const { findSessionByCwd } = await import('../../src/driver/session-manager');

         const sessions = [
            fakeSession(9223, '/Users/me/proj-a'),
            fakeSession(9224, '/Users/me/proj-b'),
         ];

         const match = findSessionByCwd(sessions as never, '/Users/me/proj-b') as { port: number };

         expect(match.port).toBe(9224);
      });

      it('matches a session whose CWD is a descendant of the hint', async () => {
         // Common case: VSCode opened the workspace root, moss runs from a worktree
         // under it. process.cwd() == workspace root, session.cwd == worktree.
         const { findSessionByCwd } = await import('../../src/driver/session-manager');

         const sessions = [ fakeSession(9223, '/Users/me/workspace/moss/.worktrees/feature-x') ];

         const match = findSessionByCwd(sessions as never, '/Users/me/workspace') as { port: number };

         expect(match.port).toBe(9223);
      });

      it('matches a session whose CWD is an ancestor of the hint', async () => {
         // Reverse case: TS server launched from a subdirectory of moss, moss itself
         // runs from the moss root. The hint is the subdir, session is the parent.
         const { findSessionByCwd } = await import('../../src/driver/session-manager');

         const sessions = [ fakeSession(9223, '/Users/me/workspace/moss') ];

         const match = findSessionByCwd(
            sessions as never,
            '/Users/me/workspace/moss/src-tauri'
         ) as { port: number };

         expect(match.port).toBe(9223);
      });

      it('prefers the deeper (more specific) match among multiple candidates', async () => {
         // Two worktrees, the hint sits inside one of them — that one should win
         // over a session whose CWD is just the shared workspace root.
         const { findSessionByCwd } = await import('../../src/driver/session-manager');

         const sessions = [
            fakeSession(9223, '/Users/me/workspace'),                          // ancestor (score=18)
            fakeSession(9224, '/Users/me/workspace/moss/.worktrees/feature-x'), // exact (score=50)
         ];

         const match = findSessionByCwd(
            sessions as never,
            '/Users/me/workspace/moss/.worktrees/feature-x'
         ) as { port: number };

         expect(match.port).toBe(9224);
      });

      it('returns null when no session shares any path prefix with the hint', async () => {
         const { findSessionByCwd } = await import('../../src/driver/session-manager');

         const sessions = [ fakeSession(9223, '/Users/me/proj-a') ];

         expect(findSessionByCwd(sessions as never, '/Users/me/proj-b')).toBeNull();
      });

      it('does not match a sibling whose CWD shares a parent but not a path boundary', async () => {
         // /foo/bar should NOT match /foo/barbaz — the boundary check `+ '/'`
         // prevents the false positive that a naive startsWith would produce.
         const { findSessionByCwd } = await import('../../src/driver/session-manager');

         const sessions = [ fakeSession(9223, '/foo/barbaz') ];

         expect(findSessionByCwd(sessions as never, '/foo/bar')).toBeNull();
      });

      it('skips sessions with null cwd and still finds the one with a real cwd', async () => {
         const { findSessionByCwd } = await import('../../src/driver/session-manager');

         const sessions = [
            fakeSession(9223, null),
            fakeSession(9224, '/Users/me/proj'),
         ];

         const match = findSessionByCwd(sessions as never, '/Users/me/proj') as { port: number };

         expect(match.port).toBe(9224);
      });
   });
});

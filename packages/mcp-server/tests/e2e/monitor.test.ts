import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readLogs } from '../../src/monitor/logs';
import { manageDriverSession } from '../../src/driver/session-manager';
import { executeJavaScript } from '../../src/driver/webview-interactions';
import { getTestAppPort } from '../test-utils';

const createConsoleTag = (description: string): string => { return `${description}-${randomUUID()}`; };

async function emitConsoleMessages(messages: readonly string[]): Promise<void> {
   await executeJavaScript({
      script: `
         ${JSON.stringify(messages)}.forEach((message) => console.log(message));
         return 'emitted';
      `,
   });
}

describe('Monitor Module E2E', () => {
   beforeAll(async () => {
      await manageDriverSession('start', undefined, getTestAppPort());
   });

   afterAll(async () => {
      await manageDriverSession('stop');
   });

   describe('Log Reading', () => {
      it('should handle system log source', async () => {
         // System logs should be available on macOS
         const logs = await readLogs({ source: 'system', lines: 5 });

         expect(logs).toBeDefined();
         expect(typeof logs).toBe('string');
      }, 10000);

      it('should read logs with default line count', async () => {
         const logs = await readLogs({ source: 'system' });

         expect(logs).toBeDefined();
      });

      it('should return the newest requested console log lines in chronological order', async () => {
         const tag = createConsoleTag('console-lines');

         await emitConsoleMessages([ 1, 2, 3, 4, 5 ].map((index) => { return `${tag}-message-${index}`; }));

         const logs = await readLogs({ source: 'console', lines: 2, filter: tag });

         expect(logs.split('\n')).toEqual([
            expect.stringContaining(`${tag}-message-4`),
            expect.stringContaining(`${tag}-message-5`),
         ]);
      });

      it('should return no more than 50 console log lines by default', async () => {
         const tag = createConsoleTag('console-default-lines'),
               messages = Array.from({ length: 55 }, (_, index) => { return `${tag}-message-${index + 1}`; });

         await emitConsoleMessages(messages);

         const logs = await readLogs({ source: 'console', filter: tag }),
               lines = logs.split('\n');

         expect(lines).toHaveLength(50);
         expect(lines[0]).toContain(`${tag}-message-6`);
         expect(lines[49]).toContain(`${tag}-message-55`);
      });
   });

   describe('Log Filtering', () => {
      it('should filter console logs before applying the line limit', async () => {
         const tag = createConsoleTag('console-filter-limit'),
               noiseTag = createConsoleTag('console-filter-noise');

         await emitConsoleMessages([
            `${tag}-match-1`,
            `${noiseTag}-noise-1`,
            `${tag}-match-2`,
            `${noiseTag}-noise-2`,
         ]);

         const logs = await readLogs({ source: 'console', lines: 2, filter: tag });

         expect(logs.split('\n')).toEqual([
            expect.stringContaining(`${tag}-match-1`),
            expect.stringContaining(`${tag}-match-2`),
         ]);
      });

      it('should preserve console log regex filtering', async () => {
         const tag = createConsoleTag('console-filter-regex');

         await emitConsoleMessages([
            `${tag}-keep-alpha`,
            `${tag}-drop-gamma`,
            `${tag}-keep-beta`,
         ]);

         const logs = await readLogs({
            source: 'console',
            lines: 10,
            filter: `${tag}-keep-(alpha|beta)`,
         });

         expect(logs.split('\n')).toEqual([
            expect.stringContaining(`${tag}-keep-alpha`),
            expect.stringContaining(`${tag}-keep-beta`),
         ]);
      });

      it('should filter console logs by timestamp before applying the line limit', async () => {
         const tag = createConsoleTag('console-since-limit'),
               sinceTime = Date.now() - 5000;

         const entries = [
            { message: `${tag}-recent-1`, timestamp: sinceTime + 1000 },
            { message: `${tag}-recent-2`, timestamp: sinceTime + 2000 },
            { message: `${tag}-old-1`, timestamp: sinceTime - 2000 },
            { message: `${tag}-old-2`, timestamp: sinceTime - 1000 },
         ];

         await executeJavaScript({
            script: `
               ${JSON.stringify(entries)}.forEach(({ message, timestamp }) => {
                  console.log(message);
                  window.__MCP_CONSOLE_LOGS__[window.__MCP_CONSOLE_LOGS__.length - 1].timestamp = timestamp;
               });
               return 'emitted';
            `,
         });

         const logs = await readLogs({
            source: 'console',
            lines: 2,
            filter: tag,
            since: new Date(sinceTime).toISOString(),
         });

         expect(logs.split('\n')).toEqual([
            expect.stringContaining(`${tag}-recent-1`),
            expect.stringContaining(`${tag}-recent-2`),
         ]);
      });

      it('should filter logs with regex pattern', async () => {
         const logs = await readLogs({ source: 'system', lines: 50, filter: 'error|warn' });

         expect(logs).toBeDefined();
      });

      it('should filter logs with keyword search', async () => {
         const logs = await readLogs({ source: 'system', lines: 50, filter: 'tauri' });

         expect(logs).toBeDefined();
      });

      it('should filter logs by timestamp', async () => {
         const since = new Date(Date.now() - 60000).toISOString(); // Last minute

         const logs = await readLogs({ source: 'system', lines: 50, since });

         expect(logs).toBeDefined();
      });

      it('should combine filters (regex + timestamp)', async () => {
         const since = new Date(Date.now() - 300000).toISOString(); // Last 5 minutes

         const logs = await readLogs({ source: 'system', lines: 50, filter: 'info', since });

         expect(logs).toBeDefined();
      });
   });
});

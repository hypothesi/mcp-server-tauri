import { execa } from 'execa';
import path from 'path';
import { describe, expect, it } from 'vitest';

import { getTestAppPort } from '../../mcp-server/tests/test-utils.js';

const CLI_PATH = path.resolve(process.cwd(), 'dist/index.js'),
      APP_READY_TIMEOUT_MS = 10000;

function runCli(args: string[]): ReturnType<typeof execa> {
   return execa('node', [ CLI_PATH, ...args ], {
      cwd: process.cwd(),
      env: {
         ...process.env,
         NO_COLOR: '1',
      },
   });
}

async function findGreetInput(): Promise<string> {
   const result = await runCli([
      'webview-find-element',
      '--raw',
      '{"selector":"#greet-input","strategy":"css"}',
      '--json',
   ]);

   return result.stdout;
}

describe('tauri-mcp CLI', () => {
   it('preserves driver sessions across separate CLI invocations', async () => {
      const port = getTestAppPort();

      await runCli([ 'driver-session', 'start', '--port', String(port) ]);

      const status = await runCli([ 'driver-session', 'status', '--json' ]),
            parsed = JSON.parse(status.stdout) as { text?: string };

      expect(parsed.text).toContain('"connected":true');
      expect(parsed.text).toContain(`"port":${port}`);

      // The bridge can start before Tauri finishes creating its initial window.
      await expect.poll(findGreetInput, { timeout: APP_READY_TIMEOUT_MS }).toContain('greet-input');

      await runCli([ 'driver-session', 'stop' ]);
   });

   it('writes screenshot output to disk and reports the path in JSON mode', async () => {
      const port = getTestAppPort(),
            outputPath = path.resolve(process.cwd(), 'tmp', 'cli-screenshot-test.png');

      await runCli([ 'driver-session', 'start', '--port', String(port) ]);

      const screenshot = await runCli([ 'webview-screenshot', '--file', outputPath, '--json' ]),
            parsed = JSON.parse(screenshot.stdout) as { files: Array<{ path: string }> };

      expect(parsed.files[0]?.path).toBe(outputPath);

      await runCli([ 'driver-session', 'stop' ]);
   });
});

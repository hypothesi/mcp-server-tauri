import { execa } from 'execa';
import path from 'path';
import { describe, expect, it } from 'vitest';

import { getTestAppPort } from '../../mcp-server/tests/test-utils.js';

const CLI_PATH = path.resolve(process.cwd(), 'dist/index.js');

function runCli(args: string[], extraEnv: Record<string, string> = {}): ReturnType<typeof execa> {
   return execa('node', [ CLI_PATH, ...args ], {
      cwd: process.cwd(),
      env: {
         ...process.env,
         NO_COLOR: '1',
         ...extraEnv,
      },
   });
}

describe('tauri-mcp CLI', () => {
   it('preserves driver sessions across separate CLI invocations', async () => {
      const port = getTestAppPort();

      await runCli([ 'driver-session', 'start', '--port', String(port) ]);

      const status = await runCli([ 'driver-session', 'status', '--json' ]),
            parsed = JSON.parse(status.stdout) as { text?: string };

      expect(parsed.text).toContain('"connected":true');
      expect(parsed.text).toContain(`"port":${port}`);

      const findResult = await runCli([
         'webview-find-element',
         '--raw',
         '{"selector":"#greet-input","strategy":"css"}',
         '--json',
      ]);

      expect(findResult.stdout).toContain('greet-input');

      await runCli([ 'driver-session', 'stop' ]);
   });

   it('writes screenshot output to disk and reports the path in JSON mode', async () => {
      const port = getTestAppPort(),
            jail = path.resolve(process.cwd(), 'tmp', 'cli-screenshots'),
            outputName = 'cli-screenshot-test.png',
            outputPath = path.join(jail, outputName);

      await runCli([ 'driver-session', 'start', '--port', String(port) ]);

      const screenshot = await runCli(
         [ 'webview-screenshot', '--file', outputName, '--json' ],
         { TAURI_MCP_SCREENSHOT_DIR: jail }
      );

      const parsed = JSON.parse(screenshot.stdout) as { files: Array<{ path: string }> };

      expect(parsed.files[0]?.path).toBe(outputPath);

      await runCli([ 'driver-session', 'stop' ]);
   });
});

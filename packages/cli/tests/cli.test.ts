import { execa } from 'execa';
import path from 'path';
import { describe, expect, it } from 'vitest';

import { getTestAppPort } from '../../mcp-server/tests/test-utils.js';

const CLI_PATH = path.resolve(process.cwd(), 'dist/index.js');

function runCli(args: string[]): ReturnType<typeof execa> {
   return execa('node', [ CLI_PATH, ...args ], {
      cwd: process.cwd(),
      env: {
         ...process.env,
         NO_COLOR: '1',
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

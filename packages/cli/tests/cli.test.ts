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

      const findResult = await runCli([
         'webview-find-element',
         '--raw',
         '{"selector":"#greet-input","strategy":"css"}',
         '--json',
      ]);

      expect(findResult.stdout).toContain('greet-input');

      await runCli([ 'driver-session', 'stop' ]);
   });

   it('passes JSON flag values to the tool as objects', async () => {
      const port = getTestAppPort(),
            probe = 'window.__cliPayloadProbe';

      await runCli([ 'driver-session', 'start', '--port', String(port) ]);

      const sum = await runCli([ 'ipc-execute-command', '--command', 'add_numbers', '--args', '{"a":5,"b":3}' ]);

      await runCli([
         'webview-execute-js',
         '--script',
         `window.__TAURI__.event.listen('cli-probe', (event) => { ${probe} = event.payload; }); return true;`,
      ]);
      await runCli([ 'ipc-emit-event', '--event-name', 'cli-probe', '--payload', '{"action":"clicked"}' ]);

      const payload = await runCli([ 'webview-execute-js', '--script', `return ${probe} && ${probe}.action;` ]);

      expect(sum.stdout).toContain('"result":8');
      expect(payload.stdout).toContain('clicked');

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

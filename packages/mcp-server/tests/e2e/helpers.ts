import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { disconnectPlugin } from '../../src/driver/plugin-client.js';

const TEST_APP_PATH = path.resolve(process.cwd(), '../test-app');

// Detect GitHub CI environment and use longer timeout

const IS_CI = Boolean(process.env.CI || process.env.GITHUB_ACTIONS);

const STARTUP_TIMEOUT_MS = IS_CI ? 480000 : 60000; // 8 minutes in CI, 1 minute locally

let tauriProcess: ChildProcess | null = null;

export async function startTestApp(): Promise<void> {
   return new Promise((resolve, reject) => {
      console.log('Starting Tauri app with devtools...');

      tauriProcess = spawn('npm', [ 'run', 'tauri', 'dev' ], {
         cwd: TEST_APP_PATH,
         stdio: 'pipe',
         shell: true,
         detached: true,
         env: {
            ...process.env,
            WEBKIT_DISABLE_COMPOSITING_MODE: '1',
            MCP_BRIDGE_TOKEN: process.env.MCP_BRIDGE_TOKEN || 'wp4-e2e-test-token',
         },
      });

      if (!tauriProcess.stdout || !tauriProcess.stderr) {
         reject(new Error('Failed to spawn Tauri process'));
         return;
      }

      let appReady = false;

      tauriProcess.stdout.on('data', (data) => {
         const output = data.toString();

         console.log('[App]:', output.trim());

         if (!appReady && (output.includes('Local:') || output.includes('http://localhost:1420'))) {
            appReady = true;
            // Wait for app to initialize
            console.log('App started, waiting for window initialization...');
            setTimeout(() => {
               console.log('Test environment ready!');
               resolve();
            }, 2000); // Reduced from 8s to 2s
         }
      });

      tauriProcess.stderr.on('data', (data) => {
         const err = data.toString();

         if (!err.includes('Compiling') && !err.includes('Building')) {
            console.error('[App Error]:', err.trim());
         }
      });

      tauriProcess.on('error', (err) => {
         reject(err);
      });

      tauriProcess.on('exit', (code) => {
         if (code !== 0 && code !== null && !appReady) {
            reject(new Error(`Tauri app exited with code ${code}`));
         }
      });

      // Timeout for app startup
      setTimeout(() => {
         if (!appReady) {
            reject(new Error(`Test app failed to start within ${STARTUP_TIMEOUT_MS / 1000}s timeout`));
         }
      }, STARTUP_TIMEOUT_MS);
   });
}

export async function stopTestApp(): Promise<void> {
   // Disconnect plugin WebSocket first to prevent reconnection attempts
   try {
      await disconnectPlugin();
   } catch(e) {
      // Ignore errors during disconnect
   }

   if (tauriProcess && tauriProcess.pid) {
      console.log('Stopping Tauri app...');
      try {
      // Kill the entire process group
         process.kill(-tauriProcess.pid, 'SIGKILL');
      } catch(e) {
         try {
            tauriProcess.kill('SIGKILL');
         } catch(e2) {
            // Ignore
         }
      }
      tauriProcess = null;
   }

   // Give it a moment to cleanup and ensure ports are free
   await new Promise((r) => { return setTimeout(r, 2000); });

   try {
      const { execa } = await import('execa');

      await execa('bash', [ '-c', 'lsof -ti:1420 | xargs kill -9 2>/dev/null || true' ]);
      await execa('bash', [ '-c', 'pkill -9 -f \'test-app\' || true' ]);
   } catch(e) {
      // Ignore errors
   }
}

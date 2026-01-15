/**
 * Bundle aria-api for browser injection.
 *
 * Uses the pre-built UMD bundle from aria-api/dist/aria.js and wraps it
 * to expose as window.ariaApi for consistency with our snapshot script.
 */

import { readFileSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url),
      currentDir = dirname(fileURLToPath(import.meta.url)),
      outputPath = join(currentDir, '../src/driver/scripts/aria-api.bundle.js');

function bundleAriaApi(): void {
   // Use the pre-built UMD bundle from aria-api
   const ariaApiPath = require.resolve('aria-api/dist/aria.js'),
         ariaApiSource = readFileSync(ariaApiPath, 'utf-8');

   // The UMD bundle exports to `global.aria`, we need to alias it to `window.ariaApi`
   const wrappedSource = `${ariaApiSource}\nwindow.ariaApi = window.aria;`;

   writeFileSync(outputPath, wrappedSource);
   console.log('aria-api bundled successfully');
}

bundleAriaApi();

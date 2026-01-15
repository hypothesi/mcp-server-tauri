/**
 * aria-api library loader
 *
 * Bundles aria-api for browser injection. Provides comprehensive W3C-compliant
 * accessibility computation including:
 * - WAI-ARIA 1.3 role computation
 * - HTML-AAM 1.0 implicit role mappings
 * - Accessible Name and Description Computation 1.2
 * - aria-owns relationship handling
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const currentDir = dirname(fileURLToPath(import.meta.url));

let ariaApiSource: string | null = null;

/** Script ID used for the aria-api library in the script registry. */
export const ARIA_API_SCRIPT_ID = '__mcp_aria_api__';

/**
 * Get the aria-api library source code.
 * Loaded lazily and cached.
 */
export function getAriaApiSource(): string {
   if (ariaApiSource === null) {
      // Load pre-bundled aria-api (created by build script)
      const bundlePath = join(currentDir, 'aria-api.bundle.js');

      ariaApiSource = readFileSync(bundlePath, 'utf-8');
   }
   return ariaApiSource;
}

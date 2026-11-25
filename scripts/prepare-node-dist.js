#!/usr/bin/env node

/* eslint-disable no-undef */

import { access, chmod, copyFile, mkdir, readdir } from 'fs/promises';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { parseArgs } from 'util';

const EXECUTABLE_MODE = 0o755;

/**
 * Copy top-level JavaScript runtime assets into a package's dist directory.
 *
 * @param {string} sourceDirectory Directory containing source assets
 * @param {string} targetDirectory Directory that receives JavaScript assets
 * @returns {Promise<readonly string[]>} Copied filenames
 */
export async function copyJavaScriptFiles(sourceDirectory, targetDirectory) {
   const entries = await readdir(sourceDirectory, { withFileTypes: true });

   const filenames = entries
      .filter((entry) => { return entry.isFile() && entry.name.endsWith('.js'); })
      .map((entry) => { return entry.name; })
      .sort();

   if (filenames.length === 0) {
      throw new Error(`No JavaScript files found in ${sourceDirectory}`);
   }

   await mkdir(targetDirectory, { recursive: true });
   await Promise.all(filenames.map((filename) => {
      return copyFile(join(sourceDirectory, filename), join(targetDirectory, filename));
   }));

   return filenames;
}

/**
 * Mark a Node entry point executable on platforms with POSIX mode bits.
 *
 * @param {string} filePath Entry point to update
 * @param {NodeJS.Platform} platform Current operating system
 * @returns {Promise<boolean>} Whether permissions were changed
 */
export async function markExecutable(filePath, platform = process.platform) {
   await access(filePath);

   if (platform === 'win32') {
      return false;
   }

   await chmod(filePath, EXECUTABLE_MODE);
   return true;
}

/**
 * Run dist preparation from command-line arguments.
 *
 * @param {readonly string[]} args Command-line arguments
 * @param {NodeJS.Platform} platform Current operating system
 */
export async function prepareNodeDist(args, platform = process.platform) {
   const { values } = parseArgs({
      args,
      options: {
         'copy-js-from': { type: 'string' },
         'copy-js-to': { type: 'string' },
         executable: { type: 'string' },
      },
      strict: true,
   });

   const copySource = values['copy-js-from'],
         copyTarget = values['copy-js-to'];

   if (Boolean(copySource) !== Boolean(copyTarget)) {
      throw new Error('Both --copy-js-from and --copy-js-to are required when copying assets');
   }

   if (!copySource && !values.executable) {
      throw new Error('No dist preparation operation was requested');
   }

   if (copySource && copyTarget) {
      await copyJavaScriptFiles(copySource, copyTarget);
   }

   if (values.executable) {
      await markExecutable(values.executable, platform);
   }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null,
      modulePath = fileURLToPath(import.meta.url);

if (invokedPath === modulePath) {
   prepareNodeDist(process.argv.slice(2)).catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
   });
}

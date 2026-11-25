import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';

import { afterEach, describe, expect, it } from 'vitest';

import {
   copyJavaScriptFiles,
   markExecutable,
   prepareNodeDist,
} from '../../../../scripts/prepare-node-dist.js';

describe('prepare-node-dist', () => {
   const temporaryDirectories: string[] = [];

   async function createTemporaryDirectory(): Promise<string> {
      const directory = await mkdtemp(path.join(tmpdir(), 'tauri-mcp-dist-'));

      temporaryDirectories.push(directory);
      return directory;
   }

   afterEach(async () => {
      await Promise.all(temporaryDirectories.splice(0).map((directory) => {
         return rm(directory, { recursive: true, force: true });
      }));
   });

   it('copies only top-level JavaScript runtime assets', async () => {
      const root = await createTemporaryDirectory(),
            source = path.join(root, 'source'),
            target = path.join(root, 'target');

      await mkdir(path.join(source, 'nested'), { recursive: true });
      await Promise.all([
         writeFile(path.join(source, 'alpha.js'), 'alpha'),
         writeFile(path.join(source, 'beta.js'), 'beta'),
         writeFile(path.join(source, 'ignored.ts'), 'ignored'),
         writeFile(path.join(source, 'nested', 'nested.js'), 'nested'),
      ]);

      const copied = await copyJavaScriptFiles(source, target);

      expect(copied).toEqual([ 'alpha.js', 'beta.js' ]);
      await expect(readFile(path.join(target, 'alpha.js'), 'utf-8')).resolves.toBe('alpha');
      await expect(readFile(path.join(target, 'beta.js'), 'utf-8')).resolves.toBe('beta');
      await expect(stat(path.join(target, 'ignored.ts'))).rejects.toThrow();
      await expect(stat(path.join(target, 'nested', 'nested.js'))).rejects.toThrow();
   });

   it('fails when the source contains no JavaScript assets', async () => {
      const root = await createTemporaryDirectory(),
            source = path.join(root, 'source'),
            target = path.join(root, 'target');

      await mkdir(source);
      await writeFile(path.join(source, 'ignored.ts'), 'ignored');

      await expect(copyJavaScriptFiles(source, target)).rejects.toThrow('No JavaScript files found');
   });

   it('skips executable permissions on Windows', async () => {
      const root = await createTemporaryDirectory(),
            entryPoint = path.join(root, 'index.js');

      await writeFile(entryPoint, '#!/usr/bin/env node');

      await expect(markExecutable(entryPoint, 'win32')).resolves.toBe(false);
   });

   it('requires the entry point to exist on Windows', async () => {
      const root = await createTemporaryDirectory();

      await expect(markExecutable(path.join(root, 'missing.js'), 'win32')).rejects.toThrow();
   });

   it.skipIf(process.platform === 'win32')('sets executable permissions on POSIX', async () => {
      const root = await createTemporaryDirectory(),
            entryPoint = path.join(root, 'index.js');

      await writeFile(entryPoint, '#!/usr/bin/env node', { mode: 0o600 });

      await expect(markExecutable(entryPoint)).resolves.toBe(true);

      const file = await stat(entryPoint);

      expect(file.mode % 0o1000).toBe(0o755);
   });

   it('requires both copy arguments', async () => {
      await expect(prepareNodeDist([ '--copy-js-from', 'source' ], 'win32')).rejects.toThrow(
         'Both --copy-js-from and --copy-js-to are required'
      );
   });
});

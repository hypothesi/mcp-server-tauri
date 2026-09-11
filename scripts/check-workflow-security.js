#!/usr/bin/env node

/* eslint-disable no-process-exit */
/* eslint-disable no-undef */

/**
 * Regression checks for SEC-008 / SEC-017 workflow hardening.
 *
 * GitHub expands ${{ }} before the shell, so version must never appear inside
 * run: script text. Publisher binaries must not come from a mutable latest URL.
 */

import { readdirSync, readFileSync } from 'fs';
import { dirname, extname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);

const __dirname = dirname(__filename);

const rootDir = join(__dirname, '..');

const VERSION_EXPR = /\$\{\{\s*needs\.determine-packages\.outputs\.version\s*\}\}/;

const LATEST_DOWNLOAD = /releases\/latest\/download/;

const SEMVER = /^[0-9]+\.[0-9]+\.[0-9]+$/;

function defaultWorkflowFiles() {
   const workflowsDir = join(rootDir, '.github', 'workflows');

   return readdirSync(workflowsDir)
      .filter((name) => {
         return [ '.yml', '.yaml' ].includes(extname(name));
      })
      .map((name) => {
         return join(workflowsDir, name);
      });
}

function extractRunBlocks(content) {
   const lines = content.split(/\r?\n/);

   const blocks = [];

   let index = 0;

   while (index < lines.length) {
      const line = lines[index];

      const match = line.match(/^(\s*)run:\s*([|>][-+]?)?\s*(.*)$/);

      if (!match) {
         index += 1;
         continue;
      }

      const indent = match[1].length;

      const blockScalar = match[2];

      const rest = match[3];

      if (blockScalar) {
         const body = rest ? [ rest ] : [];

         index += 1;
         while (index < lines.length) {
            const next = lines[index];

            if (next.trim() === '') {
               body.push(next);
               index += 1;
               continue;
            }

            const nextIndent = next.match(/^(\s*)/)[1].length;

            if (nextIndent > indent) {
               body.push(next);
               index += 1;
               continue;
            }

            break;
         }

         blocks.push(body.join('\n'));
         continue;
      }

      blocks.push(rest);
      index += 1;
   }

   return blocks;
}

function checkContent(content) {
   const errors = [];

   if (LATEST_DOWNLOAD.test(content)) {
      errors.push('contains releases/latest/download (SEC-017: pin a release tag and sha256)');
   }

   extractRunBlocks(content).forEach((block, blockIndex) => {
      if (VERSION_EXPR.test(block)) {
         errors.push(
            `run block ${blockIndex + 1} interpolates needs.determine-packages.outputs.version ` +
            '(SEC-008: pass VERSION via env: and quote "$VERSION")'
         );
      }
   });

   return errors;
}

function checkFile(filePath) {
   return checkContent(readFileSync(filePath, 'utf8'));
}

function assert(condition, message) {
   if (!condition) {
      throw new Error(message);
   }
}

function yamlSnippet(lines) {
   return lines.join('\n');
}

function selfTest() {
   const unquotedRun = yamlSnippet([
      'jobs:',
      '  release-plugin:',
      '    steps:',
      '      - name: Install and update versions',
      '        run: |',
      '          npm ci',
      '          npm version ${{ needs.determine-packages.outputs.version }} --no-git-tag-version',
   ]);

   const quotedRun = yamlSnippet([
      '        run: |',
      '          npm version "${{ needs.determine-packages.outputs.version }}" --no-git-tag-version',
   ]);

   const envQuoted = yamlSnippet([
      '    env:',
      '      VERSION: ${{ needs.determine-packages.outputs.version }}',
      '    steps:',
      '      - name: Install and update versions',
      '        run: |',
      '          npm version "$VERSION" --no-git-tag-version',
   ]);

   const latestDownload = 'curl -L "https://example.com/releases/latest/download/mcp-publisher.tar.gz" | tar xz\n';

   const pinnedDownload = yamlSnippet([
      '        env:',
      '          MCP_PUBLISHER_URL: https://github.com/modelcontextprotocol/registry/releases/download/v1.8.1/mcp-publisher_linux_amd64.tar.gz',
      '        run: |',
      '          curl -fsSL -o mcp-publisher.tar.gz "$MCP_PUBLISHER_URL"',
      '          echo "$MCP_PUBLISHER_SHA256  mcp-publisher.tar.gz" | sha256sum -c -',
   ]);

   assert(checkContent(unquotedRun).some((error) => {
      return error.includes('interpolates');
   }), 'self-test: unquoted version in run must fail');

   assert(checkContent(quotedRun).some((error) => {
      return error.includes('interpolates');
   }), 'self-test: quoted version in run must still fail');

   assert(checkContent(envQuoted).length === 0, 'self-test: env VERSION must pass');

   assert(checkContent(latestDownload).some((error) => {
      return error.includes('releases/latest/download');
   }), 'self-test: latest download must fail');

   assert(checkContent(pinnedDownload).length === 0, 'self-test: pinned download must pass');

   [ '0.13.0', '1.2.3', '0.14.0' ].forEach((version) => {
      assert(SEMVER.test(version), `self-test: accept semver ${version}`);
   });

   [ '1.2.3;id', '1.2.3$(whoami)', 'v1.2.3', '1.2.3\nplugin=true', 'latest', '' ].forEach((version) => {
      assert(!SEMVER.test(version), `self-test: reject non-semver ${JSON.stringify(version)}`);
   });

   console.log('ok  self-test');
}

function main() {
   try {
      selfTest();
   } catch(error) {
      console.error('FAIL self-test');
      console.error(`  - ${error.message}`);
      process.exit(1);
   }

   const files = process.argv.slice(2).length > 0 ? process.argv.slice(2) : defaultWorkflowFiles();

   let failed = false;

   files.forEach((filePath) => {
      const errors = checkFile(filePath);

      if (errors.length === 0) {
         console.log(`ok  ${filePath}`);
         return;
      }

      failed = true;
      console.error(`FAIL ${filePath}`);
      errors.forEach((error) => {
         console.error(`  - ${error}`);
      });
   });

   if (failed) {
      process.exit(1);
   }
}

main();

#!/usr/bin/env node

/* eslint-disable no-process-exit */
/* eslint-disable no-undef */

/**
 * Release script for individual packages in the monorepo
 * Usage: node scripts/release-package.js <package-name> [version] [--dry-run]
 *
 * Package names:
 * - plugin: @hypothesi/tauri-plugin-mcp-bridge (Cargo + NPM)
 * - server: @hypothesi/tauri-mcp-server (NPM only)
 * - cli: @hypothesi/tauri-mcp-cli (NPM only)
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);

const __dirname = dirname(__filename);

const rootDir = join(__dirname, '..');

const packages = {
   plugin: {
      name: '@hypothesi/tauri-plugin-mcp-bridge',
      path: 'packages/tauri-plugin-mcp-bridge',
      cargo: true,
      npm: true,
      githubTag: 'tauri-plugin-mcp-bridge',
   },
   server: {
      name: '@hypothesi/tauri-mcp-server',
      path: 'packages/mcp-server',
      cargo: false,
      npm: true,
      githubTag: 'tauri-mcp-server',
   },
   cli: {
      name: '@hypothesi/tauri-mcp-cli',
      path: 'packages/cli',
      cargo: false,
      npm: true,
      githubTag: 'tauri-mcp-cli',
   },
};

function exec(command, cwd = rootDir) {
   console.log(`\n> ${command}`);
   return execSync(command, { cwd, stdio: 'inherit', encoding: 'utf-8' });
}

function readJson(path) {
   return JSON.parse(readFileSync(path, 'utf-8'));
}

function writeJson(path, data) {
   writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}

function readToml(path) {
   return readFileSync(path, 'utf-8');
}

function writeToml(path, content) {
   writeFileSync(path, content);
}

function getCurrentVersion(pkg) {
   if (pkg.cargo) {
      const cargoToml = readToml(join(rootDir, pkg.path, 'Cargo.toml'));

      const match = cargoToml.match(/^version = "([^"]+)"/m);

      return match ? match[1] : null;
   }
   const packageJson = readJson(join(rootDir, pkg.path, 'package.json'));

   return packageJson.version;

}

function updateVersion(pkg, newVersion) {
   if (pkg.cargo) {
      const cargoPath = join(rootDir, pkg.path, 'Cargo.toml');

      let cargoToml = readToml(cargoPath);

      cargoToml = cargoToml.replace(/^version = "[^"]+"/m, `version = "${newVersion}"`);
      writeToml(cargoPath, cargoToml);
   }

   if (pkg.npm) {
      const packagePath = join(rootDir, pkg.path, 'package.json');

      const packageJson = readJson(packagePath);

      packageJson.version = newVersion;
      writeJson(packagePath, packageJson);
   }
}

function buildPackage(pkg) {
   console.log(`\n[BUILD] Building ${pkg.name}...`);
   if (pkg.cargo) {
      exec('cargo build --release', join(rootDir, pkg.path));
   }
   if (pkg.npm) {
      exec('npm run build', join(rootDir, pkg.path));
   }
}

function publishCargo(pkg, dryRun) {
   console.log(`\n[PUBLISH] Publishing ${pkg.name} to crates.io...`);
   const cwd = join(rootDir, pkg.path);

   if (dryRun) {
      exec('cargo package --dry-run', cwd);
      exec('cargo publish --dry-run', cwd);
   } else {
      exec('cargo package', cwd);
      exec('cargo publish', cwd);
   }
}

function publishNpm(pkg, dryRun) {
   console.log(`\n[PUBLISH] Publishing ${pkg.name} to npm...`);
   const cwd = join(rootDir, pkg.path);

   if (dryRun) {
      exec('npm publish --dry-run', cwd);
   } else {
      exec('npm publish', cwd);
   }
}

function checkGitStatus() {
   try {
      const status = execSync('git status --porcelain', { cwd: rootDir, encoding: 'utf-8', stdio: 'pipe' });

      if (status.trim()) {
         console.error('\n[ERROR] You have uncommitted changes. Please commit or stash them first.');
         process.exit(1);
      }
   } catch(error) {
      // Git might not be initialized, that's okay for dry runs
   }
}

function createGitTag(pkg, version, dryRun) {
   const tag = `${pkg.githubTag}/v${version}`;

   console.log(`\n[TAG] Creating git tag: ${tag}`);
   if (dryRun) {
      console.log(`[DRY RUN] Would create tag: ${tag}`);
   } else {
      checkGitStatus();
      exec(`git add ${pkg.path}/Cargo.toml ${pkg.path}/package.json ${pkg.path}/CHANGELOG.md`, rootDir);
      try {
         exec(`git commit -m "chore(${pkg.githubTag}): release v${version}"`, rootDir);
      } catch(error) {
      // Commit might fail if nothing changed, that's okay
         console.log('No changes to commit (versions may already be updated)');
      }
      exec(`git tag -a ${tag} -m "Release ${pkg.name} v${version}"`, rootDir);
   }
   return tag;
}

// GitHub releases are created automatically by GitHub Actions

function bumpVersion(currentVersion, type) {
   const [ major, minor, patch ] = currentVersion.split('.').map(Number);

   switch (type) {
      case 'major': {
         return `${major + 1}.0.0`;
      }
      case 'minor': {
         return `${major}.${minor + 1}.0`;
      }
      case 'patch': {
         return `${major}.${minor}.${patch + 1}`;
      }
      default: {
         return null;
      }
   }
}

function main() {
   const args = process.argv.slice(2);

   const packageKey = args[0];

   let version = args[1];

   const dryRun = args.includes('--dry-run');

   if (!packageKey || !packages[packageKey]) {
      console.error('Usage: node scripts/release-package.js <package-name> [version|patch|minor|major] [--dry-run]');
      console.error('\nAvailable packages:');
      Object.keys(packages).forEach((key) => {
         const pkg = packages[key];

         console.error(`  ${key}: ${pkg.name} (Cargo: ${pkg.cargo}, NPM: ${pkg.npm})`);
      });
      process.exit(1);
   }

   const pkg = packages[packageKey];

   const currentVersion = getCurrentVersion(pkg);

   if (!version) {
      console.error(`Current version: ${currentVersion}`);
      console.error('Please specify a new version (e.g., 0.1.1, 0.2.0, 1.0.0)');
      console.error('Or use: patch, minor, or major to auto-bump');
      process.exit(1);
   }

   // Auto-bump if patch/minor/major specified
   if ([ 'patch', 'minor', 'major' ].includes(version)) {
      version = bumpVersion(currentVersion, version);
      if (!version) {
         console.error(`Invalid current version format: ${currentVersion}`);
         process.exit(1);
      }
      console.log(`Auto-bumping ${args[1]} version: ${currentVersion} -> ${version}`);
   }

   console.log(`\n[RELEASE] Releasing ${pkg.name}`);
   console.log(`   Current version: ${currentVersion}`);
   console.log(`   New version: ${version}`);
   console.log(`   Dry run: ${dryRun ? 'YES' : 'NO'}`);

   // Update versions
   console.log(`\n[UPDATE] Updating version to ${version}...`);
   updateVersion(pkg, version);

   // Build
   buildPackage(pkg);

   // Publish
   if (pkg.cargo) {
      publishCargo(pkg, dryRun);
   }
   if (pkg.npm) {
      publishNpm(pkg, dryRun);
   }

   // Create git tag
   const tag = createGitTag(pkg, version, dryRun);

   console.log('\n[SUCCESS] Release complete!');
   console.log(`   Tag: ${tag}`);
   if (!dryRun) {
      console.log('\n   Next steps:');
      console.log(`   1. Push the tag: git push origin ${tag}`);
      console.log('   2. Push commits: git push origin HEAD');
      console.log('   3. GitHub Actions will create the release automatically');
   }
}

main();

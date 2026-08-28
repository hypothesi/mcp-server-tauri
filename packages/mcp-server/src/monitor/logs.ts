import { z } from 'zod';
import { execa } from 'execa';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { getConsoleLogs } from '../driver/webview-interactions.js';

/**
 * Find the adb executable path. Checks environment variables first, then common
 * installation locations on macOS, Linux, and Windows. This is necessary because
 * MCP servers often run without ANDROID_HOME set (e.g., global npm installs).
 */
function findAdbPath(): string {
   // Check environment variables first
   // eslint-disable-next-line no-process-env
   const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;

   if (androidHome) {
      const envPath = join(androidHome, 'platform-tools', 'adb');

      if (existsSync(envPath)) {
         return envPath;
      }
   }

   // Common installation locations to check
   const home = homedir();

   const commonPaths = [
      // macOS - Android Studio default
      join(home, 'Library', 'Android', 'sdk', 'platform-tools', 'adb'),
      // Linux - Android Studio default
      join(home, 'Android', 'Sdk', 'platform-tools', 'adb'),
      // Linux - alternative location
      join(home, 'android-sdk', 'platform-tools', 'adb'),
      // Windows - Android Studio default
      join(home, 'AppData', 'Local', 'Android', 'Sdk', 'platform-tools', 'adb.exe'),
      // Homebrew on macOS
      '/opt/homebrew/bin/adb',
      '/usr/local/bin/adb',
      // Linux system-wide
      '/usr/bin/adb',
   ];

   for (const adbPath of commonPaths) {
      if (existsSync(adbPath)) {
         return adbPath;
      }
   }

   // Fall back to PATH (will fail if not in PATH, but gives a clear error)
   return 'adb';
}

export const ReadLogsSchema = z.object({
   source: z.enum([ 'console', 'android', 'ios', 'system' ])
      .describe('Log source: "console" for webview JS logs, "android" for logcat, "ios" for simulator, "system" for desktop'),
   lines: z.number().int().positive().default(50),
   level: z.enum([ 'log', 'debug', 'info', 'warn', 'error' ]).optional()
      .describe('Only return entries at this console level.'),
   maxChars: z.number().int().min(500).max(100000).optional().default(20000)
      .describe('Maximum characters in the response. Entries are truncated and the oldest are dropped to fit.'),
   maxCharsPerEntry: z.number().int().min(100).max(20000).optional().default(2000)
      .describe('Maximum characters kept from each log entry.'),
   filter: z.string().optional().describe('Regex or keyword to filter logs'),
   since: z.string().optional().describe('ISO timestamp to filter logs since (e.g. 2023-10-27T10:00:00Z)'),
   windowId: z.string().optional().describe('Window label for console logs (defaults to "main")'),
   appIdentifier: z.union([ z.string(), z.number() ]).optional().describe(
      'App port or bundle ID for console logs. Defaults to the only connected app or the default app if multiple are connected.'
   ),
});

export interface ReadLogsOptions {
   source: 'console' | 'android' | 'ios' | 'system';
   lines?: number;
   level?: 'log' | 'debug' | 'info' | 'warn' | 'error';
   maxChars?: number;
   maxCharsPerEntry?: number;
   filter?: string;
   since?: string;
   windowId?: string;
   appIdentifier?: string | number;
}

export async function readLogs(options: ReadLogsOptions): Promise<string> {
   const { source, lines = 50, level, maxChars = 20000, maxCharsPerEntry = 2000, filter, since, windowId, appIdentifier } = options;

   try {
      let output = '';

      // Handle console logs (webview JS logs)
      if (source === 'console') {
         return await getConsoleLogs({ lines, level, maxChars, maxCharsPerEntry, filter, since, windowId, appIdentifier });
      }

      if (source === 'android') {
         const adbPath = findAdbPath();

         const args = [ 'logcat', '-d' ];

         if (since) {
            // adb logcat -T expects "MM-DD HH:MM:SS.mmm"
            const date = new Date(since);

            const month = (date.getMonth() + 1).toString().padStart(2, '0');

            const day = date.getDate().toString().padStart(2, '0');

            const hours = date.getHours().toString().padStart(2, '0');

            const minutes = date.getMinutes().toString().padStart(2, '0');

            const seconds = date.getSeconds().toString().padStart(2, '0');

            const ms = date.getMilliseconds().toString().padStart(3, '0');

            const adbTime = `${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`;

            args.push('-T', adbTime);
         } else {
            args.push('-t', lines.toString());
         }

         const { stdout } = await execa(adbPath, args, { timeout: 10000 });

         output = stdout;
      } else if (source === 'ios') {
      // iOS / macOS
         const args = [ 'log', 'show', '--style', 'syslog' ];

         if (source === 'ios') {
            args.unshift('xcrun', 'simctl', 'spawn', 'booted');
         }

         if (since) {
            // log show --start "YYYY-MM-DD HH:MM:SS"
            // It accepts ISO-like formats too usually, but let's be safe with
            // local time format if possible
            // Actually 'log show' on macOS is picky. ISO 8601 works in recent versions.
            args.push('--start', since);
         } else {
            // Default to last 1m if no since provided, as 'lines' isn't
            // directly supported by log show time window
            args.push('--last', '1m');
         }

         try {
            const { stdout } = await execa(args[0], args.slice(1));

            // We still apply line limit manually if we didn't use -t (adb)
            let outLines = stdout.split('\n');

            if (!since) {
               outLines = outLines.slice(-lines);
            }
            output = outLines.join('\n');
         } catch(e) {
            return `Error reading logs: ${e}`;
         }
      } else {
         // System (same as iOS essentially but local)
         const args = [ 'log', 'show', '--style', 'syslog' ];

         if (since) {
            args.push('--start', since);
         } else {
            args.push('--last', '1m');
         }

         try {
            const { stdout } = await execa('log', args.slice(1)); // 'log' is the command

            let outLines = stdout.split('\n');

            if (!since) {
               outLines = outLines.slice(-lines);
            }
            output = outLines.join('\n');
         } catch(e) {
            return `Error reading system logs: ${e}`;
         }
      }

      // Apply level filter
      if (level) {
         const levelPrefix = `[ ${level.toUpperCase()} ]`;

         output = output.split('\n').filter((line) => { return line.includes(levelPrefix); }).join('\n');
      }

      // Apply regex filter
      if (filter) {
         try {
            const regex = new RegExp(filter, 'i');

            output = output.split('\n').filter((line) => { return regex.test(line); }).join('\n');
         } catch(e) {
            return `Invalid filter regex: ${e}`;
         }
      }

      // Apply character budget
      const outputLines = output.split('\n');

      let budget = maxChars,
          dropped = 0;

      const finalLines = [];

      for (let i = outputLines.length - 1; i >= 0; i--) {
         let line = outputLines[i];

         if (line.length > maxCharsPerEntry) {
            line = line.slice(0, maxCharsPerEntry) + '…[' + (line.length - maxCharsPerEntry) + ' more chars]';
         }
         if (line.length > budget) {
            dropped = i + 1;
            break;
         }
         budget -= line.length + 1; // +1 for newline
         finalLines.unshift(line);
      }

      if (dropped > 0) {
         finalLines.unshift(
            '[ ' + dropped + ' older entries dropped to fit maxChars=' + maxChars +
            '. Narrow with level, filter, or since. ]'
         );
      }

      return finalLines.join('\n');
   } catch(error) {
      return `Error reading logs: ${error}`;
   }
}

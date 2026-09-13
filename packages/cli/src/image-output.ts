import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
   ensureScreenshotJail,
   resolveScreenshotOutputPath,
} from '@hypothesi/tauri-mcp-server/screenshot-path';

export interface WrittenImage {
   mimeType: string;
   path: string;
}

export async function writeImageFiles(
   toolName: string,
   content: unknown[] | null,
   requestedPath?: string
): Promise<WrittenImage[]> {
   const images = (content ?? []).filter(isImageContent);

   if (images.length === 0) {
      return [];
   }

   const jailRoot = await ensureScreenshotJail();

   const outputPaths = buildOutputPaths(toolName, images, jailRoot, requestedPath);

   const writes = images.map(async (image, index) => {
      const outputPath = outputPaths[index];

      if (!outputPath) {
         throw new Error('Image output path resolution failed.');
      }

      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(outputPath, image.data, 'base64');

      return {
         path: outputPath,
         mimeType: image.mimeType,
      };
   });

   return Promise.all(writes);
}

export function buildOutputPaths(
   toolName: string,
   images: Array<{ mimeType: string }>,
   jailRoot: string,
   requestedPath?: string
): string[] {
   if (requestedPath) {
      if (images.length === 1) {
         return [ resolveScreenshotOutputPath(requestedPath, jailRoot) ];
      }

      const resolved = resolveScreenshotOutputPath(requestedPath, jailRoot);

      const extension = path.extname(resolved);

      const baseName = extension ? resolved.slice(0, -extension.length) : resolved;

      return images.map((image, index) => {
         return resolveScreenshotOutputPath(
            `${baseName}-${index + 1}${extension || defaultExtension(image.mimeType)}`,
            jailRoot
         );
      });
   }

   const stamp = new Date().toISOString().replace(/[:.]/g, '-');

   return images.map((image, index) => {
      const suffix = images.length === 1 ? '' : `-${index + 1}`;

      return resolveScreenshotOutputPath(
         `${toolName}-${stamp}${suffix}${defaultExtension(image.mimeType)}`,
         jailRoot
      );
   });
}

function defaultExtension(mimeType: string): string {
   switch (mimeType) {
      case 'image/jpeg': {
         return '.jpg';
      }
      case 'image/webp': {
         return '.webp';
      }
      default: {
         return '.png';
      }
   }
}

function isImageContent(value: unknown): value is { type: 'image'; data: string; mimeType: string } {
   if (!value || typeof value !== 'object') {
      return false;
   }

   const candidate = value as Record<string, unknown>;

   return candidate.type === 'image' && typeof candidate.data === 'string' && typeof candidate.mimeType === 'string';
}

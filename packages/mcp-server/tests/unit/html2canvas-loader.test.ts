import { describe, expect, it } from 'vitest';

import { buildScreenshotCaptureScript } from '../../src/driver/scripts/html2canvas-loader.js';

describe('html2canvas screenshot script', () => {
   it('bounds fallback screenshots to the visible viewport', () => {
      const script = buildScreenshotCaptureScript('png', 80);

      expect(script).toContain('x: viewportX');
      expect(script).toContain('y: viewportY');
      expect(script).toContain('width: viewportWidth');
      expect(script).toContain('height: viewportHeight');
      expect(script).toContain('windowWidth: viewportWidth');
      expect(script).toContain('windowHeight: viewportHeight');
      expect(script).not.toContain('Capture the entire document');
   });
});

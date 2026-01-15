import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { manageDriverSession } from '../../src/driver/session-manager';
import { domSnapshot } from '../../src/driver/webview-interactions';
import { getTestAppPort } from '../test-utils';

/**
 * E2E tests for DOM snapshot functionality.
 * Tests the webview_dom_snapshot tool with aria-api for accessibility tree generation.
 */
describe('DOM Snapshot E2E Tests', () => {
   const TIMEOUT = 15000;

   beforeAll(async () => {
      await manageDriverSession('start', undefined, getTestAppPort());
   });

   afterAll(async () => {
      await manageDriverSession('stop');
   });

   describe('Accessibility Snapshot', () => {
      it('should generate accessibility snapshot of entire page', async () => {
         const result = await domSnapshot({ type: 'accessibility' });

         // Should contain YAML-formatted accessibility tree
         expect(result).toContain('- ');
         expect(result).toContain('[ref=');
         // Should have metadata footer
         expect(result).toContain('# Generated:');
         expect(result).toContain('# Elements indexed:');
      }, TIMEOUT);

      it('should scope snapshot to selector', async () => {
         const result = await domSnapshot({
            type: 'accessibility',
            selector: 'button',
         });

         expect(result).toContain('Scoped to: button');
         expect(result).toContain('button');
         expect(result).toContain('[ref=');
      }, TIMEOUT);

      it('should handle invalid selector gracefully', async () => {
         const result = await domSnapshot({
            type: 'accessibility',
            selector: '[[[invalid',
         });

         expect(result).toContain('Error');
         expect(result).toContain('Invalid');
      }, TIMEOUT);

      it('should handle selector not found gracefully', async () => {
         const result = await domSnapshot({
            type: 'accessibility',
            selector: '#nonexistent-element-12345',
         });

         expect(result).toContain('Error');
         expect(result).toContain('No elements found');
      }, TIMEOUT);

      it('should handle multiple matches', async () => {
         const result = await domSnapshot({
            type: 'accessibility',
            selector: 'div',
         });

         // If there are multiple divs, should show match info
         if (result.includes('elements matched')) {
            expect(result).toContain('Match 1 of');
         }
         expect(result).toContain('[ref=');
      }, TIMEOUT);

      it('should include element roles', async () => {
         const result = await domSnapshot({ type: 'accessibility' });

         // Should have common roles from the test app
         // The test app has buttons, inputs, etc.
         expect(result).toMatch(/- (button|textbox|heading|link|generic)/);
      }, TIMEOUT);

      it('should include ref IDs for all elements', async () => {
         const result = await domSnapshot({ type: 'accessibility' });

         // All elements should have ref IDs in format [... ref=eN]
         // The ref is at the end of the bracket, so match more loosely
         const refMatches = result.match(/ref=e\d+/g);

         expect(refMatches).not.toBeNull();
         if (refMatches) {
            expect(refMatches.length).toBeGreaterThan(0);
         }
      }, TIMEOUT);
   });
});

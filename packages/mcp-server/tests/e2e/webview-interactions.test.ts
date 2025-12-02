import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { manageDriverSession } from '../../src/driver/session-manager';
import {
   interact,
   screenshot,
   keyboard,
   waitFor,
   getStyles,
   executeJavaScript,
} from '../../src/driver/webview-interactions';

/**
 * E2E tests for webview interactions.
 * Now uses native Tauri IPC - works on all platforms (Linux, Windows, macOS)!
 */
describe('Webview Interactions E2E Tests', () => {
   const TIMEOUT = 10000;

   beforeAll(async () => {
      // App is already started globally - just init the session
      await manageDriverSession('start');
   });

   afterAll(async () => {
      // Don't stop the app - it's managed globally
      await manageDriverSession('stop');
   });

   describe('Gesture Interactions', () => {
      it('should perform click interaction by selector', async () => {
         const result = await interact({ action: 'click', selector: 'button' });

         expect(result).toContain('Clicked');
      }, TIMEOUT);

      it('should perform click interaction by coordinates', async () => {
         const result = await interact({ action: 'click', x: 100, y: 100 });

         expect(result).toContain('Clicked');
      }, TIMEOUT);

      it('should perform double-click interaction', async () => {
         const result = await interact({ action: 'double-click', selector: 'button' });

         expect(result).toContain('Double-clicked');
      }, TIMEOUT);

      it('should perform long-press interaction', async () => {
         const result = await interact({ action: 'long-press', selector: 'button', duration: 1000 });

         expect(result).toContain('Long-pressed');
      }, TIMEOUT);

      it('should perform swipe gesture', async () => {
         const result = await interact({
            action: 'swipe',
            fromX: 100,
            fromY: 100,
            toX: 300,
            toY: 300,
            duration: 500,
         });

         expect(result).toContain('Swiped');
      }, TIMEOUT);

      it('should perform scroll interaction', async () => {
         const result = await interact({ action: 'scroll', scrollY: 100 });

         expect(result).toContain('Scrolled');
      }, TIMEOUT);
   });

   describe('Screenshot', () => {
      it('should take full webview screenshot with valid data', async () => {
         const result = await screenshot({});

         // Result should be a ScreenshotResult with content array (not a file result)
         expect('content' in result).toBe(true);
         if (!('content' in result)) {
            throw new Error('Expected ScreenshotResult with content');
         }

         expect(Array.isArray(result.content)).toBe(true);
         expect(result.content.length).toBeGreaterThanOrEqual(2);

         // First item should be text context
         type ContentItem = { type: string; text?: string; data?: string; mimeType?: string };
         const textContent = result.content.find((c: ContentItem) => { return c.type === 'text'; }) as ContentItem | undefined;

         expect(textContent).toBeDefined();
         expect(textContent?.type).toBe('text');
         if (textContent?.type === 'text') {
            expect(textContent.text).toContain('Screenshot captured');
         }

         // Second item should be image content
         const imageContent = result.content.find((c: ContentItem) => { return c.type === 'image'; }) as ContentItem | undefined;

         expect(imageContent).toBeDefined();
         expect(imageContent?.type).toBe('image');
         if (imageContent?.type === 'image' && imageContent.data) {
            expect(imageContent.mimeType).toMatch(/^image\/(png|jpeg)$/);
            expect(imageContent.data).toBeTruthy();

            // Ensure the screenshot has meaningful content (not just a 1x1 pixel)
            // A minimal valid PNG is about 67 characters,
            // anything substantial should be much larger
            expect(imageContent.data.length).toBeGreaterThan(100);

            // Verify it's valid base64 (will throw if invalid)
            const data = imageContent.data;

            expect(() => { return Buffer.from(data, 'base64'); }).not.toThrow();
         }
      }, TIMEOUT);
   });

   describe('Keyboard Interactions', () => {
      it('should type text into an element', async () => {
         const result = await keyboard({ action: 'type', selectorOrKey: '#greet-input', textOrModifiers: 'Hello World' });

         expect(result).toContain('Typed "Hello World"');
      }, TIMEOUT);

      it('should press a key', async () => {
         const result = await keyboard({ action: 'press', selectorOrKey: 'Enter' });

         expect(result).toContain('Pressed key: Enter');
      }, TIMEOUT);

      it('should press a key with modifiers', async () => {
         const result = await keyboard({ action: 'press', selectorOrKey: 'a', textOrModifiers: [ 'Control' ] });

         expect(result).toContain('Pressed key: a');
         expect(result).toContain('Control');
      }, TIMEOUT);

      it('should perform key down', async () => {
         const result = await keyboard({ action: 'down', selectorOrKey: 'Shift' });

         expect(result).toContain('Key down: Shift');
      }, TIMEOUT);

      it('should perform key up', async () => {
         const result = await keyboard({ action: 'up', selectorOrKey: 'Shift' });

         expect(result).toContain('Key up: Shift');
      }, TIMEOUT);
   });

   describe('Wait Operations', () => {
      it('should wait for element selector', async () => {
         const result = await waitFor({ type: 'selector', value: 'body', timeout: 5000 });

         expect(result).toContain('Element found');
      }, TIMEOUT);

      it('should wait for text content', async () => {
         const result = await waitFor({ type: 'text', value: 'Welcome to Tauri', timeout: 5000 });

         expect(result).toBeDefined();
         expect(result).toContain('Text found');
      }, TIMEOUT);
   });

   describe('Style Operations', () => {
      it('should get computed styles for single element', async () => {
         const result = await getStyles({ selector: 'body', properties: [ 'color', 'background-color' ] });

         expect(result).toBeDefined();
         expect(result).not.toBe('');

         // Should contain style information as JSON
         const styles = JSON.parse(result);

         expect(styles).toHaveProperty('color');
         expect(styles).toHaveProperty('background-color');

         // Verify the values are non-empty strings (actual CSS values)
         expect(typeof styles.color).toBe('string');
         expect(styles.color.length).toBeGreaterThan(0);
         expect(typeof styles['background-color']).toBe('string');
      }, TIMEOUT);

      it('should get all computed styles', async () => {
         const result = await getStyles({ selector: 'body' });

         expect(result).toBeDefined();
         expect(result).not.toBe('');

         // Should contain many style properties
         const styles = JSON.parse(result);

         const styleKeys = Object.keys(styles);

         // Should have many CSS properties (typically 200+)
         expect(styleKeys.length).toBeGreaterThan(50);

         // Check for some common properties
         expect(styles).toHaveProperty('display');
         expect(styles).toHaveProperty('position');
         expect(styles).toHaveProperty('margin-top'); // CSS splits margin into individual sides
      }, TIMEOUT);

      it('should get styles for multiple elements', async () => {
         const result = await getStyles({ selector: 'div', multiple: true });

         expect(result).toBeDefined();
         expect(result).not.toBe('');

         // Should be an array of style objects
         const stylesArray = JSON.parse(result);

         expect(Array.isArray(stylesArray)).toBe(true);

         if (stylesArray.length > 0) {
            // Each element should have style properties
            expect(Object.keys(stylesArray[0]).length).toBeGreaterThan(50);
         }
      }, TIMEOUT);
   });

   describe('JavaScript Execution', () => {
      it('should execute JavaScript code', async () => {
         const result = await executeJavaScript({ script: 'return 2 + 2' });

         expect(result).toContain('4');
      }, TIMEOUT);

      it('should execute JavaScript with arguments', async () => {
         const result = await executeJavaScript({
            script: 'function(a, b) { return a + b; }',
            args: [ 5, 3 ],
         });

         expect(result).toContain('8');
      }, TIMEOUT);
   });

   describe('Focus and Keyboard Management', () => {
      it('should focus on element via interact action', async () => {
         const result = await interact({ action: 'focus', selector: 'input' });

         expect(result).toContain('Focused element');
      }, TIMEOUT);

      it('should dismiss keyboard via executeJavaScript', async () => {
         // First focus an element
         await interact({ action: 'focus', selector: 'input' });

         // Then dismiss keyboard by blurring
         const result = await executeJavaScript({ script: 'document.activeElement?.blur(); return "dismissed"' });

         expect(result).toContain('dismissed');
      }, TIMEOUT);
   });
});

/**
 * Keyboard interaction scripts
 */

/**
 * Type text into an element
 * @param {Object} params
 * @param {string} params.selector - CSS selector for the element
 * @param {string} params.text - Text to type
 */
function typeText(params) {
   const { selector, text } = params;

   const element = document.querySelector(selector);
   if (!element) {
      throw new Error(`Element not found: ${selector}`);
   }

   // Set the value
   element.value = text;

   // Trigger input event for frameworks that listen to it
   element.dispatchEvent(new Event('input', { bubbles: true }));
   element.dispatchEvent(new Event('change', { bubbles: true }));

   return `Typed "${text}" into ${selector}`;
}

/**
 * Send keyboard events (press, down, up)
 * @param {Object} params
 * @param {string} params.action - 'press', 'down', or 'up'
 * @param {string} params.key - Key to press
 * @param {string[]} params.modifiers - Modifier keys
 */
function keyEvent(params) {
   const { action, key, modifiers } = params;

   const eventOptions = {
      key: key,
      code: key,
      bubbles: true,
      cancelable: true,
      ctrlKey: modifiers.includes('Control'),
      altKey: modifiers.includes('Alt'),
      shiftKey: modifiers.includes('Shift'),
      metaKey: modifiers.includes('Meta'),
   };

   const activeElement = document.activeElement || document.body;

   if (action === 'press') {
      activeElement.dispatchEvent(new KeyboardEvent('keydown', eventOptions));
      activeElement.dispatchEvent(new KeyboardEvent('keypress', eventOptions));
      activeElement.dispatchEvent(new KeyboardEvent('keyup', eventOptions));
      return `Pressed key: ${key}${modifiers.length ? ' with ' + modifiers.join('+') : ''}`;
   }

   if (action === 'down') {
      activeElement.dispatchEvent(new KeyboardEvent('keydown', eventOptions));
      return `Key down: ${key}${modifiers.length ? ' with ' + modifiers.join('+') : ''}`;
   }

   if (action === 'up') {
      activeElement.dispatchEvent(new KeyboardEvent('keyup', eventOptions));
      return `Key up: ${key}${modifiers.length ? ' with ' + modifiers.join('+') : ''}`;
   }

   throw new Error(`Unknown action: ${action}`);
}

// Export for use
({ typeText, keyEvent })

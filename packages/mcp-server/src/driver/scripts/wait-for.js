/**
 * Wait for conditions script - waits for selectors, text, or events
 *
 * @param {Object} params
 * @param {string} params.type - What to wait for: 'selector', 'text', 'ipc-event'
 * @param {string} params.value - Selector/ref ID, text, or event name to wait for
 * @param {number} params.timeout - Timeout in milliseconds
 */
(async function(params) {
   const { type, value, timeout } = params;
   const startTime = Date.now();

   // Resolve element from CSS selector or ref ID (e.g., "ref=e3", "e3", or "[ref=e3]")
   // Returns null instead of throwing (used in polling loop)
   function resolveElement(selectorOrRef) {
      if (!selectorOrRef) return null;
      var resolve = window.__MCP_RESOLVE_REF__;
      if (resolve) return resolve(selectorOrRef);
      return document.querySelector(selectorOrRef);
   }

   return new Promise((resolve, reject) => {
      function check() {
         if (Date.now() - startTime > timeout) {
            reject(new Error(`Timeout waiting for ${type}: ${value}`));
            return;
         }

         if (type === 'selector') {
            const element = resolveElement(value);
            if (element) {
               resolve(`Element found: ${value}`);
               return;
            }
         } else if (type === 'text') {
            const found = document.body.innerText.includes(value);
            if (found) {
               resolve(`Text found: ${value}`);
               return;
            }
         } else if (type === 'ipc-event') {
            // For IPC events, we'd need to set up a listener
            // This is a simplified version
            reject(new Error('IPC event waiting not yet implemented in this context'));
            return;
         }

         setTimeout(check, 100);
      }

      check();
   });
})

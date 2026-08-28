/**
 * Find elements using various selector strategies and return structured data
 *
 * @param {Object} params
 * @param {string} params.selector - Element selector, ref ID (e.g., "ref=e3"), or text
 * @param {string} params.strategy - Selector strategy: 'css', 'xpath', or 'text'
 * @param {number|null} params.nth - Zero-based index to pick one of several matching elements
 * @param {number} params.limit - Maximum number of matches to return
 * @param {string[]} params.properties - Computed CSS properties to include
 * @param {boolean} params.visibleOnly - Return only rendered elements
 * @param {boolean} params.includeHtml - Include outerHTML for each match
 */
(function(params) {
   const { selector, strategy, nth, limit, properties, visibleOnly, includeHtml } = params;

   function getAccessibleName(element) {
      try {
         if (window.ariaApi && typeof window.ariaApi.getName === 'function') {
            return window.ariaApi.getName(element) || null;
         }
      } catch (e) {
         // Ignore aria-api errors
      }
      return null;
   }

   function getAttributes(element) {
      const attrs = {
         id: element.id || null,
         class: element.className || null,
         role: element.getAttribute('role') || null,
         'aria-label': element.getAttribute('aria-label') || null,
         'data-testid': element.getAttribute('data-testid') || null,
         href: element.getAttribute('href') || null,
         type: element.getAttribute('type') || null,
         disabled: element.hasAttribute('disabled') ? '' : null,
      };
      // Remove null values
      const result = {};
      for (const key in attrs) {
         if (attrs[key] !== null) {
            result[key] = attrs[key];
         }
      }
      return result;
   }

   function getStyles(element) {
      if (!properties || properties.length === 0) return null;
      const computed = window.getComputedStyle(element);
      const result = {};
      for (let i = 0; i < properties.length; i++) {
         const prop = properties[i];
         result[prop] = computed.getPropertyValue(prop);
      }
      return result;
   }

   function isInteractive(element) {
      return element.matches && element.matches(window.__MCP__.INTERACTIVE_SELECTOR);
   }

   // Get all candidates first
   var allMatches = window.__MCP__.resolveAll(selector, strategy);

   // Filter by visibility if requested
   var matches = visibleOnly
      ? allMatches.filter(function(el) { return window.__MCP__.isRendered(el); })
      : allMatches;

   const totalMatches = matches.length;

   // Apply nth if specified
   if (typeof nth === 'number') {
      if (!matches[nth]) {
         return JSON.stringify({
            selector: selector,
            strategy: strategy,
            totalMatches: totalMatches,
            returned: 0,
            truncated: false,
            matches: [],
            error: 'nth=' + nth + ' is out of range, ' + totalMatches + ' matches for ' + selector
         });
      }
      matches = [matches[nth]];
   }

   // Apply limit
   const truncated = matches.length > limit;
   if (truncated) {
      matches = matches.slice(0, limit);
   }

   const returned = matches.length;

   const results = matches.map(function(element, index) {
      const rect = element.getBoundingClientRect();
      const ref = window.__MCP__.reverseRefs && window.__MCP__.reverseRefs.has(element)
         ? Array.from(window.__MCP__.reverseRefs.entries()).find(([k, v]) => v === element)[0]
         : null;

      const match = {
         nth: typeof nth === 'number' ? nth : (index + (typeof nth !== 'number' ? 0 : 0)),
         ref: ref,
         tag: element.tagName.toLowerCase(),
         text: (element.textContent || '').trim(),
         accessibleName: getAccessibleName(element),
         attributes: getAttributes(element),
         rect: {
            x: Math.round(rect.left),
            y: Math.round(rect.top),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
         },
         visible: window.__MCP__.isRendered(element),
         interactive: isInteractive(element),
      };

      const styles = getStyles(element);
      if (styles) match.styles = styles;

      if (includeHtml) {
         const html = element.outerHTML;
         match.html = html.length > 2000 ? html.substring(0, 2000) + '…' : html;
      }

      return match;
   });

   return JSON.stringify({
      selector: selector,
      strategy: strategy,
      totalMatches: totalMatches,
      returned: returned,
      truncated: truncated,
      matches: results,
   });
})

/**
 * Shared ref resolver - always available via window.__MCP__.resolveRef.
 * Accepts a ref ID ("e3", "ref=e3", "[ref=e3]"), CSS selector, XPath, or text.
 * Returns the DOM element, or null if not found.
 *
 * Reads window.__MCP__.reverseRefs dynamically at call time so it always
 * uses the latest snapshot's data.
 *
 * Also provides:
 * - resolveAll(selector, strategy) - returns an Array of matching elements
 * - countAll(selector, strategy)   - returns the total match count
 */
(function() {
   window.__MCP__ = window.__MCP__ || {};

   var REF_PATTERN = /^\[?(?:ref=)?(e\d+)\]?$/;

   var NON_RENDERED_TAGS = {
      SCRIPT: 1, STYLE: 1, TITLE: 1, HEAD: 1, META: 1,
      LINK: 1, TEMPLATE: 1, NOSCRIPT: 1, BASE: 1,
   };

   var INTERACTIVE_SELECTOR = 'a,button,input,select,textarea,summary,' +
      '[role=button],[role=link],[role=tab],[role=menuitem],[role=option],[tabindex]';

   function isRendered(element) {
      if (!element || element.nodeType !== 1) return false;
      if (NON_RENDERED_TAGS[element.tagName]) return false;
      if (element.hidden) return false;
      if (element.getClientRects().length === 0) return false;
      try {
         var style = window.getComputedStyle(element);
         if (style.display === 'none') return false;
         if (style.visibility === 'hidden' || style.visibility === 'collapse') return false;
      } catch (e) {
         return false;
      }
      return true;
   }

   function hasMatchingDescendant(element, needle) {
      var descendants = element.querySelectorAll('*');
      for (var i = 0; i < descendants.length; i++) {
         var el = descendants[i];
         if (!isRendered(el)) continue;
         var content = (el.textContent || '').trim();
         if (content.indexOf(needle) !== -1) return true;
      }
      return false;
   }

   function preferInteractive(el) {
      if (el.matches(INTERACTIVE_SELECTOR)) return el;
      var host = el.closest(INTERACTIVE_SELECTOR);
      return host && isRendered(host) ? host : el;
   }

   function dedupe(arr) {
      var seen = new Set();
      var result = [];
      for (var i = 0; i < arr.length; i++) {
         var el = arr[i];
         if (!seen.has(el)) {
            seen.add(el);
            result.push(el);
         }
      }
      return result;
   }

   function textCandidates(needle) {
      var all = document.body ? document.body.querySelectorAll('*') : [],
          exact = [], partial = [];

      for (var i = 0; i < all.length; i++) {
         var el = all[i],
             content = (el.textContent || '').trim(),
             attributeText = [
                el.getAttribute('placeholder'),
                el.getAttribute('aria-label'),
                el.getAttribute('title'),
             ].filter(Boolean),
             exactAttribute = attributeText.indexOf(needle) !== -1,
             partialAttribute = attributeText.some(function(value) { return value.indexOf(needle) !== -1; }),
             textMatch = content.indexOf(needle) !== -1;

         if (!textMatch && !partialAttribute) continue;
         if (!isRendered(el)) continue;
         if (textMatch && el.querySelector('*') && hasMatchingDescendant(el, needle)) continue;
         (content === needle || exactAttribute ? exact : partial).push(preferInteractive(el));
      }

      return dedupe(exact.length > 0 ? exact : partial);
   }

   function xpathForText(text) {
      // Escape single quotes for XPath by splitting on ' and using concat()
      if (text.indexOf("'") === -1) {
         return "//*[contains(text(), '" + text + "')]";
      }
      var parts = text.split("'");
      var expr = 'concat(' + parts.map(function(p, i) {
         return (i > 0 ? ",\"'\",": '') + "'" + p + "'";
      }).join('') + ')';
      return '//*[contains(text(), ' + expr + ')]';
   }

   /**
    * Resolve a single element by selector and strategy.
    * @param {string} selectorOrRef - Selector, ref ID, XPath, or text
    * @param {string} [strategy]    - 'css' (default), 'xpath', or 'text'
    * @returns {Element|null}
    */
   window.__MCP__.resolveRef = function(selectorOrRef, strategy) {
      if (!selectorOrRef) return null;

      // Ref IDs always take priority regardless of strategy
      var refMatch = selectorOrRef.match(REF_PATTERN);
      if (refMatch) {
         var reverseRefs = window.__MCP__.reverseRefs;
         if (!reverseRefs) {
            throw new Error('Ref IDs require a snapshot. Run webview_dom_snapshot first to index elements.');
         }
         return reverseRefs.get(refMatch[1]) || null;
      }

      if (strategy === 'text') {
         var candidates = textCandidates(selectorOrRef);
         return candidates[0] || null;
      }

      if (strategy === 'xpath') {
         var result = document.evaluate(selectorOrRef, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
         var node = result.singleNodeValue;
         return (node && isRendered(node)) ? node : null;
      }

      // Default: CSS selector
      return document.querySelector(selectorOrRef);
   };

/**
     * Resolve all matching elements as an Array.
     * @param {string} selector  - Selector, XPath, or text
     * @param {string} [strategy] - 'css' (default), 'xpath', or 'text'
     * @returns {Element[]}
     */
   window.__MCP__.resolveAll = function(selector, strategy) {
      if (!selector) return [];

      // Ref IDs resolve to a single element
      var refMatch = selector.match(REF_PATTERN);
      if (refMatch) {
         var el = window.__MCP__.resolveRef(selector);
         return el ? [el] : [];
      }

      if (strategy === 'text') {
         return textCandidates(selector);
      }

      if (strategy === 'xpath') {
         var snapshot = document.evaluate(selector, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
         var results = [];
         for (var i = 0; i < snapshot.snapshotLength; i++) {
            var node = snapshot.snapshotItem(i);
            if (node && isRendered(node)) results.push(node);
         }
         return results;
      }

      // Default: CSS
      return Array.from(document.querySelectorAll(selector));
   };

/**
     * Count all matching elements.
     * @param {string} selector  - Selector, XPath, or text
     * @param {string} [strategy] - 'css' (default), 'xpath', or 'text'
     * @returns {number}
     */
   window.__MCP__.countAll = function(selector, strategy) {
      return window.__MCP__.resolveAll(selector, strategy).length;
   };

   // Export for reuse by other scripts
   window.__MCP__.isRendered = isRendered;
   window.__MCP__.INTERACTIVE_SELECTOR = INTERACTIVE_SELECTOR;
})();

/**
 * DOM Snapshot - Generates structured DOM representations for AI consumption
 *
 * Supports two snapshot types:
 *
 * 'accessibility' - Uses aria-api for comprehensive, spec-compliant accessibility computation:
 *   - WAI-ARIA 1.3 role computation
 *   - HTML-AAM 1.0 implicit role mappings
 *   - Accessible Name and Description Computation 1.2
 *   - aria-owns relationship handling
 *   - Shadow DOM traversal
 *
 * 'structure' - DOM structure tree with:
 *   - Element tag names
 *   - Element IDs (if present)
 *   - CSS classes (if present)
 *   - data-testid attribute (if present)
 *
 * @param {Object} params
 * @param {string} params.type - Snapshot type ('accessibility' or 'structure')
 * @param {string|null} params.selector - Optional CSS selector to scope snapshot
 */
(function(params) {
   'use strict';

   const { type, selector } = params;

   // ARIA states to include in snapshot (used by accessibility type)
   const ARIA_STATES = [
      'checked', 'disabled', 'expanded', 'pressed', 'selected',
      'hidden', 'invalid', 'required', 'readonly', 'busy',
      'current', 'grabbed', 'haspopup', 'live', 'modal',
      'multiline', 'multiselectable', 'orientation', 'sort'
   ];

   // Roles that should include value
   const VALUE_ROLES = new Set([
      'textbox', 'searchbox', 'spinbutton', 'slider',
      'scrollbar', 'progressbar', 'meter', 'combobox'
   ]);

   // ========================================================================
   // Ref ID System
   // ========================================================================

   let refCounter = 0;
   const refMap = new Map(),
         reverseRefMap = new Map();

   function getOrCreateRef(element) {
      if (!refMap.has(element)) {
         const ref = 'e' + refCounter++;
         refMap.set(element, ref);
         reverseRefMap.set(ref, element);
      }
      return refMap.get(element);
   }

   window.__MCP__ = window.__MCP__ || {};
   window.__MCP__.refs = refMap;
   window.__MCP__.reverseRefs = reverseRefMap;

   // ========================================================================
   // Visibility (using aria-api for correct aria-hidden inheritance)
   // ========================================================================

   function isAccessibilityVisible(element) {
      // Use aria-api for aria-hidden (handles inheritance)
      try {
         var ariaHidden = ariaApi.getAttribute(element, 'hidden');
         if (ariaHidden === true || ariaHidden === 'true') return false;
      } catch (e) {
         // Ignore errors from aria-api
      }

      if (element.hidden) return false;
      if (element.inert || element.closest('[inert]')) return false;

      try {
         const style = window.getComputedStyle(element);
         if (style.display === 'none') return false;
         if (style.visibility === 'hidden' || style.visibility === 'collapse') return false;
      } catch (e) {
         return false;
      }

      return true;
   }

   function isPresentational(element) {
      const role = element.getAttribute('role');
      return role === 'presentation' || role === 'none';
   }

   // ========================================================================
   // Accessibility Properties (using aria-api)
   // ========================================================================

   function getRole(element) {
      return ariaApi.getRole(element);
   }

   function getName(element) {
      return ariaApi.getName(element) || '';
   }

   function getDescription(element) {
      return ariaApi.getDescription(element) || '';
   }

   function safeGetAttribute(element, attr) {
      try {
         return ariaApi.getAttribute(element, attr);
      } catch (e) {
         return null;
      }
   }

   function getStates(element) {
      const states = {};
      const role = getRole(element);

      for (const attr of ARIA_STATES) {
         var value = safeGetAttribute(element, attr);
         if (value !== null && value !== undefined && value !== '') {
            if (value === true || value === 'true') {
               states[attr] = true;
            } else if (value === false || value === 'false') {
               if (['expanded', 'pressed', 'checked', 'selected'].includes(attr)) {
                  states[attr] = false;
               }
            } else if (value === 'mixed') {
               states[attr] = 'mixed';
            } else {
               states[attr] = value;
            }
         }
      }

      // Heading level
      if (role === 'heading') {
         var ariaLevel = safeGetAttribute(element, 'level');
         if (ariaLevel) {
            states.level = parseInt(ariaLevel, 10);
         } else if (/^H[1-6]$/i.test(element.tagName)) {
            states.level = parseInt(element.tagName[1], 10);
         }
      }

      // Value for value-bearing roles
      if (VALUE_ROLES.has(role)) {
         var valueNow = safeGetAttribute(element, 'valuenow');
         var valueText = safeGetAttribute(element, 'valuetext');
         if (valueText) states.valuetext = valueText;
         else if (valueNow !== null) states.valuenow = valueNow;

         if ((role === 'textbox' || role === 'searchbox') && element.value) {
            states.value = element.value;
         }
      }

      return states;
   }

   // ========================================================================
   // Tree Building (using aria-api for aria-owns aware traversal)
   // ========================================================================

   // Roles to skip (filter out like Chrome DevTools does)
   const SKIP_ROLES = new Set(['generic', 'none', 'presentation']);

   // Roles that are structural landmarks (keep even without name)
   const LANDMARK_ROLES = new Set([
      'banner', 'main', 'contentinfo', 'navigation', 'complementary',
      'region', 'search', 'form', 'application', 'document'
   ]);

   function buildAriaTree(element, depth, maxDepth) {
      depth = depth || 0;
      maxDepth = maxDepth || 100;

      if (depth > maxDepth) return { type: 'error', message: 'Max depth exceeded' };
      if (!isAccessibilityVisible(element)) return null;

      // Handle presentational elements
      if (isPresentational(element)) {
         const children = getAccessibleChildren(element, depth, maxDepth);
         if (children.length === 0) return null;
         if (children.length === 1) return children[0];
         return { type: 'fragment', children: children };
      }

      const role = getRole(element);
      const name = getName(element);
      const description = getDescription(element);
      const states = getStates(element);
      const ref = getOrCreateRef(element);
      const children = getAccessibleChildren(element, depth, maxDepth);

      // Skip generic/none roles (like Chrome DevTools) - just return children
      if (SKIP_ROLES.has(role) && !name) {
         if (children.length === 0) return null;
         if (children.length === 1) return children[0];
         return { type: 'fragment', children: children };
      }

      if (!role && !name && children.length === 0) return null;

      // Get URL for links (like Playwright)
      var url;
      if (role === 'link' && element.href) {
         url = element.href;
      }

      // Check cursor style for interactive elements (like Playwright's [cursor=pointer])
      var cursor;
      try {
         var computedStyle = window.getComputedStyle(element);
         if (computedStyle.cursor === 'pointer') {
            cursor = 'pointer';
         }
      } catch (e) {
         // Ignore style errors
      }

      return {
         type: 'element',
         role: role || 'generic',
         name: name || undefined,
         description: description || undefined,
         states: Object.keys(states).length > 0 ? states : undefined,
         url: url,
         cursor: cursor,
         ref: ref,
         children: children.length > 0 ? children : undefined
      };
   }

   function getAccessibleChildren(element, depth, maxDepth) {
      const children = [];
      // Use aria-api's getChildNodes for aria-owns support
      const childNodes = ariaApi.getChildNodes(element);

      for (const child of childNodes) {
         if (child.nodeType === Node.ELEMENT_NODE) {
            const childTree = buildAriaTree(child, depth + 1, maxDepth);
            if (childTree) {
               if (childTree.type === 'fragment') {
                  children.push.apply(children, childTree.children);
               } else {
                  children.push(childTree);
               }
            }
         } else if (child.nodeType === Node.TEXT_NODE) {
            const text = child.textContent ? child.textContent.trim() : '';
            // Use text type like Playwright
            if (text) children.push({ type: 'text', content: text });
         }
      }

      return children;
   }

   // ========================================================================
   // Playwright-compatible YAML Rendering
   // ========================================================================

   function yamlEscape(str) {
      if (!str) return '""';
      var needsQuotes = /[\n\r\t:#{}\[\],&*?|<>=!%@`]/.test(str) ||
                        str.startsWith(' ') || str.endsWith(' ') ||
                        str.includes('"') || str.includes("'");
      if (!needsQuotes && !/^[\d.+-]/.test(str)) return str;
      return '"' + str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
                      .replace(/\n/g, '\\n').replace(/\r/g, '\\r') + '"';
   }

   function renderYaml(node, indent) {
      indent = indent || 0;
      var prefix = '  '.repeat(indent);
      if (!node) return '';

      // Text nodes (like Playwright)
      if (node.type === 'text') {
         return prefix + '- text: ' + yamlEscape(node.content) + '\n';
      }

      if (node.type === 'fragment') {
         return node.children.map(function(c) { return renderYaml(c, indent); }).join('');
      }

      if (node.type === 'error') {
         return prefix + '# ERROR: ' + node.message + '\n';
      }

      // Build line: - role "name" [attrs] [ref=X]
      var line = prefix + '- ' + node.role;
      if (node.name) line += ' ' + yamlEscape(node.name);

      // Build attributes in brackets like Playwright
      var attrs = [];
      if (node.states) {
         for (var key in node.states) {
            if (Object.prototype.hasOwnProperty.call(node.states, key)) {
               var value = node.states[key];
               // Skip false values (cleaner output)
               if (value === false) continue;
               if (value === true) {
                  attrs.push(key);
               } else if (typeof value === 'number') {
                  attrs.push(key + '=' + value);
               } else {
                  attrs.push(key + '=' + yamlEscape(String(value)));
               }
            }
         }
      }
      attrs.push('ref=' + node.ref);

      // Add cursor style like Playwright
      if (node.cursor) {
         attrs.push('cursor=' + node.cursor);
      }

      if (attrs.length > 0) {
         line += ' [' + attrs.join('] [') + ']';
      }

      // Check if we have children or URL/description to add
      var hasChildren = node.children && node.children.length > 0;
      var hasUrl = !!node.url;
      var hasDescription = !!node.description;

      if (hasChildren || hasUrl || hasDescription) {
         line += ':\n';
         // Add URL as child like Playwright
         if (hasUrl) {
            line += prefix + '  - /url: ' + node.url + '\n';
         }
         // Add description as child if present
         if (hasDescription) {
            line += prefix + '  - /description: ' + yamlEscape(node.description) + '\n';
         }
         // Render children
         if (hasChildren) {
            line += node.children.map(function(c) { return renderYaml(c, indent + 1); }).join('');
         }
      } else {
         line += '\n';
      }

      return line;
   }

   // ========================================================================
   // Main Execution
   // ========================================================================

   if (type !== 'accessibility' && type !== 'structure') {
      throw new Error('Unsupported snapshot type: "' + type + '". Supported: \'accessibility\', \'structure\'');
   }

   // ========================================================================
   // Structure Snapshot (DOM structure tree)
   // ========================================================================

   function isStructureVisible(element) {
      if (element.hidden) return false;
      try {
         var style = window.getComputedStyle(element);
         if (style.display === 'none') return false;
         if (style.visibility === 'hidden' || style.visibility === 'collapse') return false;
      } catch (e) {
         return false;
      }
      return true;
   }

   function buildStructureTree(element, depth, maxDepth) {
      depth = depth || 0;
      maxDepth = maxDepth || 100;

      if (depth > maxDepth) return { type: 'error', message: 'Max depth exceeded' };
      if (!isStructureVisible(element)) return null;

      var tag = element.tagName.toLowerCase();
      var id = element.id || undefined;
      var classes = element.classList.length > 0
         ? Array.from(element.classList)
         : undefined;
      var testId = element.getAttribute('data-testid') || undefined;
      var ref = getOrCreateRef(element);

      var children = [];
      for (var i = 0; i < element.children.length; i++) {
         var childTree = buildStructureTree(element.children[i], depth + 1, maxDepth);
         if (childTree) children.push(childTree);
      }

      return {
         type: 'element',
         tag: tag,
         id: id,
         classes: classes,
         testId: testId,
         ref: ref,
         children: children.length > 0 ? children : undefined
      };
   }

   function renderStructureYaml(node, indent) {
      indent = indent || 0;
      var prefix = '  '.repeat(indent);
      if (!node) return '';

      if (node.type === 'error') {
         return prefix + '# ERROR: ' + node.message + '\n';
      }

      // Build element descriptor: tag#id.class1.class2
      var descriptor = node.tag;
      if (node.id) descriptor += '#' + node.id;
      if (node.classes) descriptor += '.' + node.classes.join('.');

      var attrs = ['ref=' + node.ref];
      if (node.testId) attrs.push('data-testid=' + yamlEscape(node.testId));

      var line = prefix + '- ' + descriptor + ' [' + attrs.join(' ') + ']';

      if (node.children && node.children.length > 0) {
         line += ':\n' + node.children.map(function(c) {
            return renderStructureYaml(c, indent + 1);
         }).join('');
      } else {
         line += '\n';
      }

      return line;
   }

   // For structure type, we don't need aria-api
   if (type === 'structure') {
      var structureRoots = [];
      var structureScopeInfo = '';

      if (selector) {
         try {
            document.querySelector(selector);
         } catch (e) {
            return 'Error: Invalid CSS selector "' + selector + '": ' + e.message;
         }

         var structureElements = document.querySelectorAll(selector);
         if (structureElements.length === 0) {
            return 'Error: No elements found matching selector "' + selector + '"';
         }

         structureRoots = Array.from(structureElements);
         structureScopeInfo = '# Scoped to: ' + selector + '\n';
         if (structureRoots.length > 1) structureScopeInfo += '# ' + structureRoots.length + ' elements matched\n';
      } else {
         structureRoots = [document.body];
      }

      var structureOutput = structureScopeInfo;

      structureRoots.forEach(function(root, index) {
         if (structureRoots.length > 1) structureOutput += '\n# ─── Match ' + (index + 1) + ' of ' + structureRoots.length + ' ───\n';

         try {
            var tree = buildStructureTree(root);
            structureOutput += tree ? renderStructureYaml(tree) : '# (empty or hidden)\n';
         } catch (e) {
            structureOutput += '# ERROR: ' + e.message + '\n';
         }
      });

      structureOutput += '\n# ───────────────────────────────────────\n';
      structureOutput += '# Generated: ' + new Date().toISOString() + '\n';
      structureOutput += '# Elements indexed: ' + refCounter + '\n';
      structureOutput += '# Use [ref=eN] with other webview tools\n';

      return structureOutput.trim();
   }

   // ========================================================================
   // Accessibility Snapshot (requires aria-api)
   // ========================================================================

   // Validate aria-api is available
   var ariaApi = window.ariaApi;
   if (!ariaApi) {
      throw new Error('aria-api library not loaded');
   }

   var roots = [];
   var scopeInfo = '';

   if (selector) {
      try {
         document.querySelector(selector);
      } catch (e) {
         return 'Error: Invalid CSS selector "' + selector + '": ' + e.message;
      }

      var elements = document.querySelectorAll(selector);
      if (elements.length === 0) {
         return 'Error: No elements found matching selector "' + selector + '"';
      }

      roots = Array.from(elements);
      scopeInfo = '# Scoped to: ' + selector + '\n';
      if (roots.length > 1) scopeInfo += '# ' + roots.length + ' elements matched\n';
   } else {
      roots = [document.body];
   }

   var output = scopeInfo;

   roots.forEach(function(root, index) {
      if (roots.length > 1) output += '\n# ─── Match ' + (index + 1) + ' of ' + roots.length + ' ───\n';

      try {
         var tree = buildAriaTree(root);
         output += tree ? renderYaml(tree) : '# (empty or hidden)\n';
      } catch (e) {
         output += '# ERROR: ' + e.message + '\n';
      }
   });

   output += '\n# ───────────────────────────────────────\n';
   output += '# Generated: ' + new Date().toISOString() + '\n';
   output += '# Elements indexed: ' + refCounter + '\n';
   output += '# Use [ref=eN] with other webview tools\n';

   return output.trim();
})

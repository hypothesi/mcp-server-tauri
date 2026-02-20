/**
 * Element picker overlay for MCP Server Tauri.
 *
 * Activated by the agent via webview_select_element. Displays a hover highlight,
 * context tooltip, and cancel bar. On click (desktop) or two-tap (mobile) the
 * selected element's metadata is emitted as a Tauri event so the MCP server can
 * retrieve it asynchronously.
 *
 * @param {Object} params
 * @param {string} params.mode - 'pick' (agent-initiated picker)
 * @param {string} params.pickerId - Unique identifier for this picker session
 */
(function(params) {
   var mode = params.mode;
   var pickerId = params.pickerId;

   // Duplicate-activation guard
   if (window.__MCP_PICKER_ACTIVE__) {
      // Cancel the previous picker
      var prevId = window.__MCP_PICKER_ACTIVE__;
      cleanup();
      if (window.__TAURI__ && window.__TAURI__.event && window.__TAURI__.event.emit) {
         window.__TAURI__.event.emit('__element_picked', { pickerId: prevId, cancelled: true });
      }
   }
   window.__MCP_PICKER_ACTIVE__ = pickerId;

   var isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
   var highlight = null;
   var tooltip = null;
   var cancelBar = null;
   var trackedElement = null; // element currently being highlighted
   var rafId = null; // requestAnimationFrame handle for cyclic repositioning

   // ── Velocity-based hover throttling state ──────────────────────────────
   var lastMouseX = 0;
   var lastMouseY = 0;
   var lastMouseTime = 0;
   var mouseVelocity = 0;
   var hoverUpdateTimer = null;

   // ── Cancel bar ─────────────────────────────────────────────────────────
   cancelBar = document.createElement('div');
   cancelBar.setAttribute('data-mcp-picker', 'cancel-bar');
   var cancelBarAtTop = true;
   cancelBar.style.cssText =
      'position:fixed;top:0;left:0;right:0;z-index:2147483647;height:40px;' +
      'background:rgba(30,41,59,0.95);display:flex;align-items:center;' +
      'justify-content:space-between;padding:0 12px;font:13px/1 system-ui,sans-serif;' +
      'color:#E2E8F0;box-sizing:border-box;' +
      'transition:top 0.2s ease,bottom 0.2s ease;';

   var cancelText = document.createElement('span');
   cancelText.textContent = 'MCP Element Picker \u2014 Click to select | ESC or tap X to cancel';
   cancelText.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;';

   // Move button — toggles bar between top and bottom
   var moveBtn = document.createElement('button');
   moveBtn.setAttribute('data-mcp-picker', 'move-btn');
   moveBtn.textContent = '\u2193'; // ↓
   moveBtn.title = 'Move bar to bottom';
   moveBtn.style.cssText =
      'background:none;border:none;color:#94A3B8;font-size:16px;cursor:pointer;' +
      'width:32px;height:40px;display:flex;align-items:center;justify-content:center;' +
      'flex-shrink:0;';
   function toggleCancelBarPosition(e) {
      e.stopPropagation();
      e.preventDefault();
      cancelBarAtTop = !cancelBarAtTop;
      cancelBar.style.top = cancelBarAtTop ? '0' : 'auto';
      cancelBar.style.bottom = cancelBarAtTop ? 'auto' : '0';
      moveBtn.textContent = cancelBarAtTop ? '\u2193' : '\u2191'; // ↓ or ↑
      moveBtn.title = cancelBarAtTop ? 'Move bar to bottom' : 'Move bar to top';
   }
   moveBtn.addEventListener('click', toggleCancelBarPosition);
   moveBtn.addEventListener('touchend', toggleCancelBarPosition);

   var cancelBtn = document.createElement('button');
   cancelBtn.setAttribute('data-mcp-picker', 'cancel-btn');
   cancelBtn.textContent = '\u2715';
   cancelBtn.style.cssText =
      'background:none;border:none;color:#E2E8F0;font-size:20px;cursor:pointer;' +
      'width:40px;height:40px;display:flex;align-items:center;justify-content:center;' +
      'flex-shrink:0;';
   cancelBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      cancelPicker();
   });
   cancelBtn.addEventListener('touchend', function(e) {
      e.stopPropagation();
      e.preventDefault();
      cancelPicker();
   });

   cancelBar.appendChild(cancelText);
   cancelBar.appendChild(moveBtn);
   cancelBar.appendChild(cancelBtn);
   document.body.appendChild(cancelBar);

   // ── Highlight helpers ──────────────────────────────────────────────────
   function createHighlight() {
      var el = document.createElement('div');
      el.setAttribute('data-mcp-picker', 'highlight');
      el.style.cssText =
         'position:fixed;z-index:2147483645;pointer-events:none;' +
         'background:rgba(59,130,246,0.15);border:2px solid #3B82F6;';
      document.body.appendChild(el);
      return el;
   }

   function positionHighlight(el, target) {
      var rect = target.getBoundingClientRect();
      el.style.top = rect.top + 'px';
      el.style.left = rect.left + 'px';
      el.style.width = rect.width + 'px';
      el.style.height = rect.height + 'px';
   }

   // ── Cyclic highlight repositioning via rAF ─────────────────────────────
   // Keeps the highlight tracking animated or repositioned elements at ~60fps.
   function startTracking() {
      if (rafId) return;
      function tick() {
         if (trackedElement && highlight) {
            positionHighlight(highlight, trackedElement);
         }
         rafId = requestAnimationFrame(tick);
      }
      rafId = requestAnimationFrame(tick);
   }

   function stopTracking() {
      if (rafId) {
         cancelAnimationFrame(rafId);
         rafId = null;
      }
   }

   // ── Tooltip helpers ────────────────────────────────────────────────────
   function showTooltip(target) {
      if (!tooltip) {
         tooltip = document.createElement('div');
         tooltip.setAttribute('data-mcp-picker', 'tooltip');
         tooltip.style.cssText =
            'position:fixed;z-index:2147483646;pointer-events:none;' +
            'background:#1E293B;color:#E2E8F0;font:12px/1.4 monospace;' +
            'padding:4px 8px;border-radius:4px;white-space:nowrap;max-width:300px;' +
            'overflow:hidden;text-overflow:ellipsis;';
         document.body.appendChild(tooltip);
      }

      var rect = target.getBoundingClientRect();
      var tag = target.tagName.toLowerCase();
      var id = target.id ? '#' + target.id : '';
      var cls = target.className && typeof target.className === 'string'
         ? '.' + target.className.trim().split(/\s+/).join('.')
         : '';
      var label = (tag + id + cls);
      if (label.length > 60) label = label.substring(0, 57) + '...';
      label += ' (' + Math.round(rect.width) + '\u00d7' + Math.round(rect.height) + ')';
      tooltip.textContent = label;

      // Position above or below the element
      var tooltipTop = rect.top - 28;
      if (tooltipTop < 44) { // below the cancel bar (40px + 4px padding)
         tooltipTop = rect.bottom + 4;
      }
      tooltip.style.top = tooltipTop + 'px';
      tooltip.style.left = Math.max(4, rect.left) + 'px';
   }

   function hideTooltip() {
      if (tooltip && tooltip.parentNode) {
         tooltip.parentNode.removeChild(tooltip);
         tooltip = null;
      }
   }

   // ── Element detection ──────────────────────────────────────────────────
   // Uses the shared elementsFromPoint helper from bridge.js when available,
   // falls back to document.elementFromPoint.
   function findElementAt(x, y) {
      if (window.__MCP_GET_ELEMENT_AT_POINT__) {
         return window.__MCP_GET_ELEMENT_AT_POINT__(x, y);
      }
      // Fallback: hide highlight, use single elementFromPoint
      if (highlight) highlight.style.display = 'none';
      var el = document.elementFromPoint(x, y);
      if (highlight) highlight.style.display = '';
      return el;
   }

   // ── Picker element detection guard (fallback for findElementAt) ────────
   function isPickerUI(el) {
      while (el) {
         if (el.getAttribute && el.getAttribute('data-mcp-picker')) {
            return true;
         }
         el = el.parentElement;
      }
      return false;
   }

   // ── Selection ──────────────────────────────────────────────────────────
   function selectElement(target) {
      var metadata;
      if (window.__MCP_COLLECT_ELEMENT_METADATA__) {
         metadata = window.__MCP_COLLECT_ELEMENT_METADATA__(target);
      } else {
         metadata = { tag: target.tagName.toLowerCase(), cssSelector: '' };
      }

      // Store in window for later retrieval
      window.__MCP_PICKED_ELEMENT__ = metadata;

      // Remove overlay + tooltip but keep highlight for screenshot
      removeCancelBar();
      hideTooltip();
      stopTracking();
      removeListeners();

      // Emit Tauri event
      if (window.__TAURI__ && window.__TAURI__.event && window.__TAURI__.event.emit) {
         window.__TAURI__.event.emit('__element_picked', { pickerId: pickerId, element: metadata });
      }

      window.__MCP_PICKER_ACTIVE__ = null;
      return 'Element selected: ' + metadata.tag + (metadata.id ? '#' + metadata.id : '');
   }

   // ── Cancellation ──────────────────────────────────────────────────────
   function cancelPicker() {
      cleanup();
      if (window.__TAURI__ && window.__TAURI__.event && window.__TAURI__.event.emit) {
         window.__TAURI__.event.emit('__element_picked', { pickerId: pickerId, cancelled: true });
      }
      window.__MCP_PICKER_ACTIVE__ = null;
   }

   // ── Cleanup ────────────────────────────────────────────────────────────
   function removeCancelBar() {
      if (cancelBar && cancelBar.parentNode) {
         cancelBar.parentNode.removeChild(cancelBar);
         cancelBar = null;
      }
   }

   function removeHighlight() {
      if (highlight && highlight.parentNode) {
         highlight.parentNode.removeChild(highlight);
         highlight = null;
      }
   }

   function cleanup() {
      removeCancelBar();
      removeHighlight();
      hideTooltip();
      stopTracking();
      removeListeners();
      trackedElement = null;
      if (hoverUpdateTimer) {
         clearTimeout(hoverUpdateTimer);
         hoverUpdateTimer = null;
      }
      window.__MCP_PICKER_ACTIVE__ = null;
   }

   // ── Core hover-update logic (shared by throttled and immediate paths) ──
   function updateHoveredElement() {
      var el = findElementAt(lastMouseX, lastMouseY);

      if (!el || isPickerUI(el)) return;

      if (el === trackedElement) return; // no change
      trackedElement = el;

      if (!highlight) {
         highlight = createHighlight();
         startTracking();
      }
      positionHighlight(highlight, el);
      showTooltip(el);
   }

   // ── Desktop: hover + click with velocity throttling ────────────────────
   function onMouseMove(e) {
      var now = performance.now();
      var dx = e.clientX - lastMouseX;
      var dy = e.clientY - lastMouseY;
      var dt = now - lastMouseTime;
      var distance = Math.sqrt(dx * dx + dy * dy);

      lastMouseX = e.clientX;
      lastMouseY = e.clientY;

      // Calculate velocity in pixels per second
      mouseVelocity = dt > 0 ? (distance / dt) * 1000 : 0;
      lastMouseTime = now;

      // If moving fast (>600 px/s), throttle updates to ~28fps
      if (mouseVelocity > 600) {
         if (hoverUpdateTimer) {
            clearTimeout(hoverUpdateTimer);
         }
         hoverUpdateTimer = setTimeout(updateHoveredElement, 36); // ~28fps
      } else {
         if (hoverUpdateTimer) {
            clearTimeout(hoverUpdateTimer);
            hoverUpdateTimer = null;
         }
         updateHoveredElement();
      }
   }

   function onClick(e) {
      // Let clicks on picker UI (cancel, move buttons) pass through to their handlers
      if (isPickerUI(e.target)) return;

      e.preventDefault();
      e.stopPropagation();

      var el = findElementAt(e.clientX, e.clientY);

      if (!el || isPickerUI(el)) return;

      selectElement(el);
   }

   // ── Mobile: two-tap ────────────────────────────────────────────────────
   var lastTapTarget = null;

   function onTouchEnd(e) {
      var touch = e.changedTouches[0];
      if (!touch) return;

      var el = findElementAt(touch.clientX, touch.clientY);

      // Let taps on picker UI (cancel, move buttons) pass through to their handlers
      if (!el || isPickerUI(el)) return;

      e.preventDefault();
      e.stopPropagation();

      if (lastTapTarget === el) {
         // Second tap on same element -> confirm
         selectElement(el);
      } else {
         // First tap (or different element) -> highlight
         lastTapTarget = el;
         trackedElement = el;

         if (!highlight) {
            highlight = createHighlight();
            startTracking();
         }
         positionHighlight(highlight, el);
         showTooltip(el);

         if (cancelText) {
            cancelText.textContent = 'Tap element again to send | X Cancel';
         }
      }
   }

   // ── Keyboard escape ────────────────────────────────────────────────────
   function onKeyDown(e) {
      if (e.key === 'Escape') {
         e.preventDefault();
         e.stopPropagation();
         cancelPicker();
      }
   }

   // ── Listener management ────────────────────────────────────────────────
   function removeListeners() {
      document.removeEventListener('mousemove', onMouseMove, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('touchend', onTouchEnd, true);
      document.removeEventListener('keydown', onKeyDown, true);
   }

   // Attach appropriate listeners based on device
   document.addEventListener('keydown', onKeyDown, true);

   if (isTouch) {
      document.addEventListener('touchend', onTouchEnd, true);
   }

   // Always attach mouse listeners (hybrid devices like touch laptops)
   document.addEventListener('mousemove', onMouseMove, true);
   document.addEventListener('click', onClick, true);

   return 'Picker activated (id: ' + pickerId + ')';
})

// MCP Bridge: Enables eval() contexts to communicate with Tauri IPC
// This bridge is automatically injected by the mcp-bridge plugin
// It forwards DOM events from eval() contexts to Tauri IPC and back

(function() {
   'use strict';

   var ipcMonitorEnabled = false,
       originalInvoke = null,
       origLog, origDebug, origInfo, origWarn, origError, bridgeLogger;

   // MCP bridge logger - scoped with levels and tags
   function createMcpLogger(scope) {
      return {
         info: function() {
            var args = Array.prototype.slice.call(arguments);

            args.unshift('[MCP][' + scope + '][INFO]');
            console.log.apply(console, args);
         },
         warn: function() {
            var args = Array.prototype.slice.call(arguments);

            args.unshift('[MCP][' + scope + '][WARN]');
            console.warn.apply(console, args);
         },
         error: function() {
            var args = Array.prototype.slice.call(arguments);

            args.unshift('[MCP][' + scope + '][ERROR]');
            console.error.apply(console, args);
         },
         tag: function(tag, message) {
            console.error('[MCP][' + scope + '][' + tag + ']', message);
         },
      };
   }

   bridgeLogger = createMcpLogger('BRIDGE');

   // Initialize console capture so logs are captured from app startup
   function initConsoleCapture() {
      var args, message;

      if (window.__MCP_CONSOLE_LOGS__) {
         return; // Already initialized
      }

      origLog = console.log;
      origDebug = console.debug;
      origInfo = console.info;
      origWarn = console.warn;
      origError = console.error;

      window.__MCP_CONSOLE_LOGS__ = [];

      function captureLog(level, origFn) {
         return function() {
            args = Array.prototype.slice.call(arguments);

            try {
               message = args
                  .map(function(a) {
                     return typeof a === 'object' ? JSON.stringify(a) : String(a);
                  })
                  .join(' ');
            } catch(e) {
               message = args.map(String).join(' ');
            }

            window.__MCP_CONSOLE_LOGS__.push({
               level: level,
               message: message,
               timestamp: Date.now(),
            });

            origFn.apply(console, args);
         };
      }

      console.log = captureLog('log', origLog);
      console.debug = captureLog('debug', origDebug);
      console.info = captureLog('info', origInfo);
      console.warn = captureLog('warn', origWarn);
      console.error = captureLog('error', origError);

      bridgeLogger.info('Console capture initialized');
   }

   // Wait for Tauri API to be available
   function waitForTauri(callback) {
      if (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke) {
         // eslint-disable-next-line callback-return
         callback();
      } else {
         setTimeout(function() {
            waitForTauri(callback);
         }, 50);
      }
   }

   // =========================================================================
   // IPC Monitoring
   // =========================================================================

   /**
    * Enables IPC monitoring by replacing the Tauri core object.
    * Called from Rust via execute_js when start_ipc_monitor is invoked.
    *
    * Note: window.__TAURI__.core.invoke is read-only in Tauri v2, so we replace
    * the entire core object with a new one that wraps invoke.
    */
   window.__MCP_START_IPC_MONITOR__ = function() {
      var originalCore, wrappedInvoke;

      if (ipcMonitorEnabled) {
         return;
      }

      if (!window.__TAURI__ || !window.__TAURI__.core || !window.__TAURI__.core.invoke) {
         bridgeLogger.error('Cannot start IPC monitor: Tauri API not available');
         return;
      }

      originalCore = window.__TAURI__.core;
      originalInvoke = originalCore.invoke;
      ipcMonitorEnabled = true;

      wrappedInvoke = function(cmd, args) {
         var startTime = Date.now();

         function reportEvent(result, error, duration) {
            var reportPromise;

            if (!originalInvoke) {
               return;
            }

            reportPromise = originalInvoke('plugin:mcp-bridge|report_ipc_event', {
               command: cmd,
               args: args || {},
               result: result,
               error: error,
               durationMs: duration,
            });

            reportPromise.catch(function() {
               // Ignore errors from reporting
            });
         }

         return originalInvoke(cmd, args)
            .then(function(result) {
               reportEvent(result, null, Date.now() - startTime);
               return result;
            })
            .catch(function(error) {
               reportEvent(null, error.message || String(error), Date.now() - startTime);
               throw error;
            });
      };

      // Create a new core object with all original properties plus wrapped invoke
      window.__TAURI__.core = Object.assign({}, originalCore, { invoke: wrappedInvoke });

      bridgeLogger.info('IPC monitoring started');
   };

   /**
    * Disables IPC monitoring and restores the original core object.
    * Called from Rust via execute_js when stop_ipc_monitor is invoked.
    */
   window.__MCP_STOP_IPC_MONITOR__ = function() {
      if (!ipcMonitorEnabled || !originalInvoke) {
         return;
      }

      // Restore original invoke by creating a new core object
      window.__TAURI__.core = Object.assign({}, window.__TAURI__.core, { invoke: originalInvoke });
      originalInvoke = null;
      ipcMonitorEnabled = false;

      bridgeLogger.info('IPC monitoring stopped');
   };

   waitForTauri(function() {
      bridgeLogger.info('Tauri API available, initializing bridge');

      // Initialize console capture immediately so logs are captured from the start
      initConsoleCapture();

      // Capture unhandled JS errors and promise rejections while preserving
      // default behavior
      if (!window.__MCP_UNHANDLED_ERRORS_CAPTURED__) {
         window.__MCP_UNHANDLED_ERRORS_CAPTURED__ = true;

         window.addEventListener('error', function(event) {
            var message, source, line;

            try {
               message = event.message || 'Unhandled error';
               source = event.filename ? ' at ' + event.filename : '';
               line = typeof event.lineno === 'number' ? ':' + event.lineno : '';

               bridgeLogger.tag('UNHANDLED_ERROR', message + source + line);
            } catch(e) {
               // Best-effort logging; do not interfere with default handling
            }
         });

         window.addEventListener('unhandledrejection', function(event) {
            var reason, reasonMessage;

            try {
               reason = event.reason;

               if (reason && typeof reason === 'object') {
                  if (reason instanceof Error && reason.message) {
                     reasonMessage = reason.message;
                  } else {
                     try {
                        reasonMessage = JSON.stringify(reason);
                     } catch(e) {
                        reasonMessage = String(reason);
                     }
                  }
               } else {
                  reasonMessage = String(reason);
               }

               bridgeLogger.tag('UNHANDLED_REJECTION', reasonMessage);
            } catch(e) {
               // Best-effort logging; do not interfere with default handling
            }
         });
      }

      // Listen for execution requests from eval() contexts
      window.addEventListener('__mcp_exec_request', async function(event) {
         const request = event.detail;

         bridgeLogger.info('Received request:', request);

         try {
            // Forward to Tauri IPC using the global API
            const result = await window.__TAURI__.core.invoke(
               request.command,
               request.args
            );

            bridgeLogger.info('Command succeeded, sending response');

            // Send success response back via DOM event
            window.dispatchEvent(new CustomEvent('__mcp_exec_response', {
               detail: {
                  execId: request.execId,
                  success: true,
                  data: result,
               },
            }));
         } catch(error) {
            bridgeLogger.error('Command failed:', error);

            // Send error response back via DOM event
            window.dispatchEvent(new CustomEvent('__mcp_exec_response', {
               detail: {
                  execId: request.execId,
                  success: false,
                  error: error.message || String(error),
               },
            }));
         }
      });

      // Mark bridge as ready
      window.__MCP_BRIDGE_READY__ = true;
      bridgeLogger.info('Ready');

      // Notify Rust that the page has loaded and scripts should be re-injected
      // This is called after the bridge is ready to ensure Tauri IPC is available
      notifyPageLoaded();
   });

   // =========================================================================
   // Script Injection Functions
   // =========================================================================

   /**
    * Injects scripts into the DOM. Called by Rust when scripts need to be injected.
    * @param {Array<{id: string, type: 'inline'|'url', content: string}>} scripts
    */
   window.__MCP_INJECT_SCRIPTS__ = function(scripts) {
      var script;

      if (!Array.isArray(scripts)) {
         bridgeLogger.error('Invalid scripts array');
         return;
      }

      scripts.forEach(function(entry) {
         if (!entry || !entry.id) {
            return;
         }

         // Check if script already exists
         if (document.querySelector('script[data-mcp-script-id="' + entry.id + '"]')) {
            bridgeLogger.info('Script already exists:', entry.id);
            return;
         }

         script = document.createElement('script');

         script.setAttribute('data-mcp-script-id', entry.id);

         if (entry.type === 'url') {
            script.src = entry.content;
            script.async = true;
            script.onload = function() {
               bridgeLogger.info('URL script loaded:', entry.id);
            };
            script.onerror = function() {
               bridgeLogger.error('Failed to load URL script:', entry.id);
            };
         } else {
            // Inline script
            script.textContent = entry.content;
         }

         document.head.appendChild(script);
         bridgeLogger.info('Injected script:', entry.id);
      });
   };

   /**
    * Removes a script from the DOM by ID.
    * @param {string} scriptId
    */
   window.__MCP_REMOVE_SCRIPT__ = function(scriptId) {
      var script = document.querySelector('script[data-mcp-script-id="' + scriptId + '"]');

      if (script) {
         script.remove();
         bridgeLogger.info('Removed script:', scriptId);
      }
   };

   /**
    * Removes all MCP-managed scripts from the DOM.
    */
   window.__MCP_CLEAR_SCRIPTS__ = function() {
      var scripts = document.querySelectorAll('script[data-mcp-script-id]');

      scripts.forEach(function(s) {
         s.remove();
      });
      bridgeLogger.info('Cleared', scripts.length, 'scripts');
   };

   /**
    * Notifies Rust that the page has loaded and scripts should be re-injected.
    * Uses the Tauri event system to communicate with the plugin.
    */
   function notifyPageLoaded() {
      // Use Tauri's invoke to request script re-injection.
      // The plugin responds by calling __MCP_INJECT_SCRIPTS__ with registered scripts.
      if (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke) {
         window.__TAURI__.core.invoke('plugin:mcp-bridge|request_script_injection')
            .catch(function(err) {
               // This command may not exist in older versions, which is fine
               bridgeLogger.warn('Script injection request:', err.message || 'not available');
            });
      }
   }

   // Also listen for navigation events to re-inject scripts
   // This handles SPA-style navigation where the page doesn't fully reload
   window.addEventListener('popstate', function() {
      bridgeLogger.info('Navigation detected (popstate)');
      notifyPageLoaded();
   });
}());

/**
 * Single source of truth for all MCP prompt definitions
 * Prompts are user-controlled templates that appear as slash commands in MCP clients
 */

import { PLUGIN_VERSION_CARGO } from './version.js';
import { SETUP_INSTRUCTIONS as SETUP_PROMPT } from './constants.js';

export interface PromptArgument {
   name: string;
   description: string;
   required?: boolean;
}

export interface PromptMessage {
   role: 'user' | 'assistant';
   content: {
      type: 'text';
      text: string;
   };
}

export interface PromptDefinition {
   name: string;
   description: string;
   arguments?: PromptArgument[];
   handler: (args: Record<string, string>) => PromptMessage[];
}

const FIX_WEBVIEW_ERRORS_PROMPT = `I need help finding and fixing JavaScript errors in my Tauri app's webview.

Please follow these steps:

1. **Start a session** - Use \`driver_session\` with action "start" to connect to the running Tauri app

2. **Get console logs** - Use \`read_logs\` with source "console" to retrieve JavaScript errors or warnings

3. **Analyze the errors** - Look at the error messages, stack traces, and identify:
   - What type of error it is (TypeError, ReferenceError, SyntaxError, etc.)
   - Which file and line number the error originates from
   - What the root cause might be

4. **Find the source code** - Use code search or file reading tools to locate the problematic code in my project

5. **Propose a fix** - Explain what's wrong and suggest a concrete fix for each error found

6. **Stop the session** - Use \`driver_session\` with action "stop" to clean up

If no errors are found, let me know the app is running cleanly.

If the session fails to start, help me troubleshoot the connection (is the app running? is the MCP bridge plugin installed?).`;



const SELECT_ELEMENT_PROMPT = (message?: string): string => {
   const lines = [
      'The user wants to visually select an element in their running Tauri app so they can discuss it with you.',
      '',
      'Follow these steps:',
      '',
      '1. **Ensure a session is active** - Use `driver_session` with action "start" if not already connected',
      '',
      '2. **Activate the element picker** - Call `webview_select_element` to show the picker overlay in the app.',
      'The user will see a blue highlight following their cursor and can click to select an element.',
      'They can press Escape or click X to cancel.',
      '',
      '3. **Review the result** - You will receive the element\'s metadata (tag, id, classes, CSS selector, XPath,',
      'bounding rect, attributes, computed styles, parent chain) and an annotated screenshot with the element highlighted.',
      '',
      '4. **Respond to the user** - Use the element context and screenshot to address their request.',
   ];

   if (message) {
      lines.push(
         '',
         '## User\'s Message About the Element',
         '',
         message
      );
   }

   return lines.join('\n');
};

/**
 * Complete registry of all available prompts
 */
export const PROMPTS: PromptDefinition[] = [
   {
      name: 'fix-webview-errors',
      description:
         '[Tauri Apps Only] Find and fix JavaScript errors in a running Tauri app. ' +
         'Use ONLY for Tauri projects (with src-tauri/ and tauri.conf.json). ' +
         'For browser debugging, use Chrome DevTools MCP instead. ' +
         'For Electron apps, this prompt will NOT work.',
      arguments: [],
      handler: () => {
         return [
            {
               role: 'user',
               content: {
                  type: 'text',
                  text: FIX_WEBVIEW_ERRORS_PROMPT,
               },
            },
         ];
      },
   },

   {
      name: 'select',
      description:
         'Visually select an element in the running Tauri app. ' +
         'Activates a picker overlay — click an element to send its metadata and an annotated screenshot to the agent. ' +
         'Optionally include a message describing what you want to do with the element.',
      arguments: [
         {
            name: 'message',
            description: 'What you want to discuss or do with the selected element (e.g. "this button should be green instead of blue")',
            required: false,
         },
      ],
      handler: (args) => {
         return [
            {
               role: 'user',
               content: {
                  type: 'text',
                  text: SELECT_ELEMENT_PROMPT(args.message),
               },
            },
         ];
      },
   },

   {
      name: 'setup',
      description:
         'Set up or update the MCP Bridge plugin in a Tauri project. ' +
         'Examines the project, reports what changes are needed, and asks for permission before ' +
         'making any modifications. Use for initial setup or to update to the latest version.',
      arguments: [],
      handler: () => {
         return [
            {
               role: 'user',
               content: {
                  type: 'text',
                  text: SETUP_PROMPT,
               },
            },
         ];
      },
   },
];

/**
 * Create a Map for fast prompt lookup by name
 */
export const PROMPT_MAP = new Map(PROMPTS.map((prompt) => { return [ prompt.name, prompt ]; }));

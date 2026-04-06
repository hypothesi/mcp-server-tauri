/**
 * Script Manager - Manages persistent script injection across page navigations.
 *
 * This module provides functions to register, remove, and manage scripts that
 * should be automatically re-injected when pages load or navigate.
 *
 * @internal This module is for internal use only and is not exposed as MCP tools.
 */

import { ensureSessionAndConnect } from './plugin-client.js';

/**
 * Type of script to inject.
 */
export type ScriptType = 'inline' | 'url';

/**
 * A script entry in the registry.
 */
export interface ScriptEntry {

   /** Unique identifier for this script. */
   id: string;

   /** Type of script (inline code or external URL). */
   type: ScriptType;

   /** The script content (JavaScript code) or URL. */
   content: string;
}

/**
 * Response from script registration.
 */
interface RegisterScriptResponse {
   registered: boolean;
   scriptId: string;
}

/**
 * Response from script removal.
 */
interface RemoveScriptResponse {
   removed: boolean;
   scriptId: string;
}

/**
 * Response from clearing scripts.
 */
interface ClearScriptsResponse {
   cleared: number;
}

/**
 * Response from getting scripts.
 */
interface GetScriptsResponse {
   scripts: ScriptEntry[];
}

/**
 * Registers a script to be injected into the webview.
 *
 * The script will be immediately injected if the page is loaded, and will be
 * automatically re-injected on subsequent page loads/navigations.
 *
 * @param id - Unique identifier for the script
 * @param type - Type of script ('inline' for code, 'url' for external script)
 * @param content - The script content (JavaScript code) or URL
 * @param windowLabel - Optional window label to target
 * @returns Promise resolving to registration result
 */
export async function registerScript(
   id: string,
   type: ScriptType,
   content: string,
   windowLabel?: string,
   appIdentifier?: string | number
): Promise<RegisterScriptResponse> {
   const client = await ensureSessionAndConnect(appIdentifier);

   const response = await client.sendCommand({
      command: 'register_script',
      args: { id, type, content, windowLabel },
   });

   if (!response.success) {
      throw new Error(response.error || 'Failed to register script');
   }

   return response.data as RegisterScriptResponse;
}

/**
 * Removes a script from the registry and DOM.
 *
 * @param id - The script ID to remove
 * @param windowLabel - Optional window label to target
 * @returns Promise resolving to removal result
 */
export async function removeScript(
   id: string,
   windowLabel?: string,
   appIdentifier?: string | number
): Promise<RemoveScriptResponse> {
   const client = await ensureSessionAndConnect(appIdentifier);

   const response = await client.sendCommand({
      command: 'remove_script',
      args: { id, windowLabel },
   });

   if (!response.success) {
      throw new Error(response.error || 'Failed to remove script');
   }

   return response.data as RemoveScriptResponse;
}

/**
 * Clears all registered scripts from the registry and DOM.
 *
 * @param windowLabel - Optional window label to target
 * @returns Promise resolving to the number of scripts cleared
 */
export async function clearScripts(
   windowLabel?: string,
   appIdentifier?: string | number
): Promise<ClearScriptsResponse> {
   const client = await ensureSessionAndConnect(appIdentifier);

   const response = await client.sendCommand({
      command: 'clear_scripts',
      args: { windowLabel },
   });

   if (!response.success) {
      throw new Error(response.error || 'Failed to clear scripts');
   }

   return response.data as ClearScriptsResponse;
}

/**
 * Gets all registered scripts.
 *
 * @returns Promise resolving to the list of registered scripts
 */
export async function getScripts(appIdentifier?: string | number): Promise<GetScriptsResponse> {
   const client = await ensureSessionAndConnect(appIdentifier);

   const response = await client.sendCommand({
      command: 'get_scripts',
      args: {},
   });

   if (!response.success) {
      throw new Error(response.error || 'Failed to get scripts');
   }

   return response.data as GetScriptsResponse;
}

/**
 * Checks if a script with the given ID is registered.
 *
 * @param id - The script ID to check
 * @returns Promise resolving to true if the script is registered
 */
export async function isScriptRegistered(id: string, appIdentifier?: string | number): Promise<boolean> {
   const { scripts } = await getScripts(appIdentifier);

   return scripts.some((s) => { return s.id === id; });
}

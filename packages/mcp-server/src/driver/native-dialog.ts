import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { ensureSessionAndConnect, type PluginClient } from './plugin-client.js';

const TargetSchema = {
   windowId: z.string().optional().describe('Tauri window label whose owned native dialog chain should be targeted'),
   appIdentifier: z.union([ z.string(), z.number() ]).optional().describe(
      'App identifier (port or bundle ID) when multiple Tauri apps are connected'
   ),
   timeoutMs: z.number().int().min(100).max(10000).default(2000).describe(
      'Bounded time to wait for the native operation, from 100 to 10000 milliseconds'
   ),
} as const;

/** Schema for discovering native dialogs owned by the targeted Tauri window. */
export const NativeDialogSnapshotSchema = z.object({
   ...TargetSchema,
   minOwnerDepth: z.number().int().min(1).max(8).default(1).describe(
      'Minimum owner-chain depth to return: 1 for direct dialogs, 2 for confirmations owned by another dialog'
   ),
});

const InteractionTargetSchema = {
   elementRef: z.string().min(1).describe('Opaque elementRef from the latest native_dialog_snapshot'),
   ...TargetSchema,
} as const;

/**
 * Schema for invoking UI Automation patterns on a discovered native dialog element.
 */
export const NativeDialogInteractSchema = z.discriminatedUnion('action', [
   z.object({
      action: z.literal('invoke').describe('Invoke a button through UI Automation InvokePattern'),
      ...InteractionTargetSchema,
   }),
   z.object({
      action: z.literal('setValue').describe('Set an editable filename/path through UI Automation ValuePattern'),
      value: z.string().min(1).max(32767).describe('Complete absolute filename/path; the value is never logged'),
      ...InteractionTargetSchema,
   }),
   z.object({
      action: z.literal('setPaths').describe('Set one or more existing files in a multi-select Open dialog'),
      paths: z.array(z.string().min(1).max(32767)).min(1).max(100).describe(
         'Complete absolute file paths for a multi-file Open dialog; path values are never logged'
      ),
      ...InteractionTargetSchema,
   }),
   z.object({
      action: z.literal('select').describe('Select a control through UI Automation SelectionItemPattern'),
      ...InteractionTargetSchema,
   }),
]);

export type NativeDialogSnapshotOptions = z.input<typeof NativeDialogSnapshotSchema>;
export type NativeDialogInteractOptions = z.input<typeof NativeDialogInteractSchema>;

const sessionScopes = new WeakMap<PluginClient, string>();

function getSessionScope(client: PluginClient): string {
   const existing = sessionScopes.get(client);

   if (existing) {
      return existing;
   }

   const scope = randomUUID();

   sessionScopes.set(client, scope);
   return scope;
}

function resultAsJSON(data: unknown): string {
   return JSON.stringify(data, null, 2);
}

/** Discover bounded semantic UI Automation controls in native Windows dialogs. */
export async function snapshotNativeDialog(options: NativeDialogSnapshotOptions): Promise<string> {
   const parsed = NativeDialogSnapshotSchema.parse(options),
         client = await ensureSessionAndConnect(parsed.appIdentifier);

   const response = await client.sendCommand({
      command: 'native_dialog_snapshot',
      args: {
         windowLabel: parsed.windowId,
         timeoutMs: parsed.timeoutMs,
         scopeId: getSessionScope(client),
         minOwnerDepth: parsed.minOwnerDepth,
      },
   }, parsed.timeoutMs + 1500);

   if (!response.success) {
      throw new Error(response.error || 'Native dialog snapshot failed');
   }

   return resultAsJSON(response.data);
}

/** Interact with a native dialog element using its advertised UI Automation pattern. */
export async function interactWithNativeDialog(options: NativeDialogInteractOptions): Promise<string> {
   const parsed = NativeDialogInteractSchema.parse(options),
         client = await ensureSessionAndConnect(parsed.appIdentifier);

   const response = await client.sendCommand({
      command: 'native_dialog_interact',
      args: {
         windowLabel: parsed.windowId,
         timeoutMs: parsed.timeoutMs,
         scopeId: getSessionScope(client),
         elementRef: parsed.elementRef,
         action: parsed.action,
         value: parsed.action === 'setValue' ? parsed.value : undefined,
         paths: parsed.action === 'setPaths' ? parsed.paths : undefined,
      },
   }, parsed.timeoutMs + 1500);

   if (!response.success) {
      throw new Error(response.error || 'Native dialog interaction failed');
   }

   return resultAsJSON(response.data);
}

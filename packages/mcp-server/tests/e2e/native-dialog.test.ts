import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
   interactWithNativeDialog,
   snapshotNativeDialog,
} from '../../src/driver/native-dialog';
import { manageDriverSession } from '../../src/driver/session-manager';
import { executeJavaScript, interact, waitFor } from '../../src/driver/webview-interactions';
import { getTestAppPort } from '../test-utils';

interface SnapshotControl {
   elementRef?: string;
   name?: string;
   semanticRole?: string;
   supportedActions: string[];
}

interface Snapshot {
   dialogs: Array<{
      dialogRef: string;
      parentDialogRef?: string;
      ownerDepth: number;
      kind: string;
      controls: SnapshotControl[];
   }>;
}

const windowsDescribe = process.platform === 'win32' ? describe : describe.skip;

windowsDescribe('Native Windows dialog automation E2E', () => {
   const TIMEOUT = 15000;

   beforeAll(async () => {
      await manageDriverSession('start', undefined, getTestAppPort());
   });

   afterAll(async () => {
      await manageDriverSession('stop');
   });

   afterEach(async () => {
      try {
         const snapshot: Snapshot = JSON.parse(await snapshotNativeDialog({ timeoutMs: 500 })),
               control = findControl(snapshot, 'invoke', [ 'cancel', 'close', 'no', 'accept' ]);

         await invoke(control);
      } catch{
         // No dialog is the expected cleanup state.
      }
   });

   async function openDialog(selector: string): Promise<Snapshot> {
      await interact({ action: 'click', selector });
      return JSON.parse(await snapshotNativeDialog({ timeoutMs: 8000 }));
   }

   function findControl(
      snapshot: Snapshot,
      action: string,
      semanticRoles: string[]
   ): SnapshotControl & { elementRef: string } {
      const controls = snapshot.dialogs.flatMap((dialog) => { return dialog.controls; });

      function supportsAction(control: SnapshotControl): boolean {
         return control.supportedActions.includes(action);
      }

      function findSemanticControl(role: string): SnapshotControl | undefined {
         return controls.find((control) => {
            return control.semanticRole === role && control.supportedActions.includes(action);
         });
      }

      const semanticMatch = semanticRoles.map(findSemanticControl).find((control) => { return Boolean(control); }),
            patternMatch = controls.find(supportsAction);

      const control = semanticMatch ?? patternMatch;

      if (!control?.elementRef) {
         throw new Error(`No ${action} control found in native dialog snapshot`);
      }
      return { ...control, elementRef: control.elementRef };
   }

   async function invoke(control: SnapshotControl): Promise<void> {
      await interactWithNativeDialog({
         action: 'invoke',
         elementRef: control.elementRef,
         timeoutMs: 3000,
      });
   }

   it('discovers and acknowledges a message dialog without breaking webview automation', async () => {
      const snapshot = await openDialog('#dialog-message');

      expect(snapshot.dialogs[0]?.kind).toBe('message');
      await invoke(findControl(snapshot, 'invoke', [ 'accept', 'close' ]));
      await waitFor({ type: 'text', value: 'Message dialog closed.', timeout: 3000 });

      const webviewResult = await executeJavaScript({ script: 'return document.querySelector("#dialog-result")?.textContent' });

      expect(webviewResult).toContain('Message dialog closed.');
   }, TIMEOUT);

   it('answers ask and confirm dialogs using non-localized semantic roles', async () => {
      const askSnapshot = await openDialog('#dialog-ask');

      await invoke(findControl(askSnapshot, 'invoke', [ 'yes', 'accept', 'primary' ]));
      await waitFor({ type: 'text', value: 'Ask result: Yes', timeout: 3000 });

      const confirmSnapshot = await openDialog('#dialog-confirm');

      await invoke(findControl(confirmSnapshot, 'invoke', [ 'cancel', 'secondary' ]));
      await waitFor({ type: 'text', value: 'Confirm result: Cancel', timeout: 3000 });
   }, TIMEOUT);

   it('sets absolute Open and Save paths through ValuePattern and accepts them', async () => {
      const fixtureDirectory = await mkdtemp(path.join(tmpdir(), 'tauri-mcp-dialog-')),
            fixturePath = path.join(fixtureDirectory, 'fixture.txt'),
            savePath = path.join(fixtureDirectory, 'saved-output.txt');

      try {
         await writeFile(fixturePath, 'temporary fixture', 'utf8');
         const snapshot = await openDialog('#dialog-open'),
               valueControl = findControl(snapshot, 'setValue', [ 'fileName', 'editable' ]),
               acceptControl = findControl(snapshot, 'invoke', [ 'accept' ]);

         await interactWithNativeDialog({
            action: 'setValue',
            elementRef: valueControl.elementRef,
            value: fixturePath,
            timeoutMs: 3000,
         });
         await invoke(acceptControl);
         await waitFor({ type: 'text', value: 'Open result:', timeout: 3000 });

         const result = await executeJavaScript({ script: 'return document.querySelector("#dialog-result")?.textContent' });

         expect(result).toContain('fixture.txt');

         const saveSnapshot = await openDialog('#dialog-save'),
               saveValueControl = findControl(saveSnapshot, 'setValue', [ 'fileName', 'editable' ]),
               saveAcceptControl = findControl(saveSnapshot, 'invoke', [ 'accept' ]);

         await interactWithNativeDialog({
            action: 'setValue',
            elementRef: saveValueControl.elementRef,
            value: savePath,
            timeoutMs: 3000,
         });
         await invoke(saveAcceptControl);
         await waitFor({ type: 'text', value: 'Save result:', timeout: 3000 });

         const saveResult = await executeJavaScript({ script: 'return document.querySelector("#dialog-result")?.textContent' });

         expect(saveResult).toContain('saved-output.txt');
      } finally {
         await rm(fixtureDirectory, { recursive: true, force: true });
      }
   }, TIMEOUT);

   it('selects multiple absolute files in one Open dialog', async () => {
      const fixtureDirectory = await mkdtemp(path.join(tmpdir(), 'tauri-mcp-multi-dialog-')),
            firstPath = path.join(fixtureDirectory, 'first.txt'),
            secondPath = path.join(fixtureDirectory, 'second.txt');

      try {
         await Promise.all([
            writeFile(firstPath, 'first fixture', 'utf8'),
            writeFile(secondPath, 'second fixture', 'utf8'),
         ]);
         const snapshot = await openDialog('#dialog-open-multiple'),
               valueControl = findControl(snapshot, 'setPaths', [ 'fileName' ]),
               acceptControl = findControl(snapshot, 'invoke', [ 'accept' ]);

         await interactWithNativeDialog({
            action: 'setPaths',
            elementRef: valueControl.elementRef,
            paths: [ firstPath, secondPath ],
            timeoutMs: 3000,
         });
         await invoke(acceptControl);
         await waitFor({ type: 'text', value: 'Multiple open result:', timeout: 3000 });

         const result = await executeJavaScript({ script: 'return document.querySelector("#dialog-result")?.textContent' });

         expect(result).toContain('first.txt');
         expect(result).toContain('second.txt');
      } finally {
         await rm(fixtureDirectory, { recursive: true, force: true });
      }
   }, TIMEOUT);

   it('selects an absolute directory in a folder picker', async () => {
      const fixtureDirectory = await mkdtemp(path.join(tmpdir(), 'tauri-mcp-folder-dialog-'));

      try {
         const snapshot = await openDialog('#dialog-folder'),
               valueControl = findControl(snapshot, 'setValue', [ 'fileName', 'editable' ]),
               acceptControl = findControl(snapshot, 'invoke', [ 'accept' ]);

         await interactWithNativeDialog({
            action: 'setValue',
            elementRef: valueControl.elementRef,
            value: fixtureDirectory,
            timeoutMs: 3000,
         });
         await invoke(acceptControl);
         await waitFor({ type: 'text', value: 'Folder result:', timeout: 3000 });

         const result = await executeJavaScript({ script: 'return document.querySelector("#dialog-result")?.textContent' });

         expect(result).toContain(path.basename(fixtureDirectory));
      } finally {
         await rm(fixtureDirectory, { recursive: true, force: true });
      }
   }, TIMEOUT);

   it('discovers navigation controls and selectable file-system entries', async () => {
      function isNavigationRole(role: string | undefined): boolean {
         return [ 'back', 'forward', 'up', 'addressBar', 'currentLocation', 'navigationTreeItem' ]
            .includes(role ?? '');
      }

      function isFileSystemEntry(control: SnapshotControl): boolean {
         return control.semanticRole === 'fileSystemEntry';
      }

      const fixtureDirectory = await mkdtemp(path.join(tmpdir(), 'tauri-mcp-navigation-dialog-')),
            fixturePath = path.join(fixtureDirectory, 'navigation-fixture.txt');

      try {
         await writeFile(fixturePath, 'navigation fixture', 'utf8');
         const snapshot = await openDialog('#dialog-open'),
               controls = snapshot.dialogs.flatMap((dialog) => { return dialog.controls; }),
               roles = controls.map((control) => { return control.semanticRole; }),
               hasNavigationControl = roles.some(isNavigationRole),
               valueControl = findControl(snapshot, 'setValue', [ 'fileName' ]),
               acceptControl = findControl(snapshot, 'invoke', [ 'accept' ]);

         expect(hasNavigationControl).toBe(true);
         await interactWithNativeDialog({
            action: 'setValue',
            elementRef: valueControl.elementRef,
            value: fixtureDirectory,
            timeoutMs: 3000,
         });
         await invoke(acceptControl);

         const navigatedSnapshot: Snapshot = JSON.parse(await snapshotNativeDialog({ timeoutMs: 4000 })),
               navigatedControls = navigatedSnapshot.dialogs.flatMap((dialog) => { return dialog.controls; }),
               entries = navigatedControls.filter(isFileSystemEntry);

         expect(entries.some((entry) => { return entry.name === 'navigation-fixture.txt'; })).toBe(true);
         await invoke(findControl(navigatedSnapshot, 'invoke', [ 'cancel' ]));
      } finally {
         await rm(fixtureDirectory, { recursive: true, force: true });
      }
   }, TIMEOUT);

   it('follows nested ownership to accept a Save overwrite confirmation', async () => {
      const fixtureDirectory = await mkdtemp(path.join(tmpdir(), 'tauri-mcp-overwrite-dialog-')),
            existingPath = path.join(fixtureDirectory, 'existing.txt');

      try {
         await writeFile(existingPath, 'existing fixture', 'utf8');
         const saveSnapshot = await openDialog('#dialog-save'),
               valueControl = findControl(saveSnapshot, 'setValue', [ 'fileName' ]),
               acceptControl = findControl(saveSnapshot, 'invoke', [ 'accept' ]);

         await interactWithNativeDialog({
            action: 'setValue',
            elementRef: valueControl.elementRef,
            value: existingPath,
            timeoutMs: 3000,
         });
         await invoke(acceptControl);

         const confirmation: Snapshot = JSON.parse(await snapshotNativeDialog({
            minOwnerDepth: 2,
            timeoutMs: 4000,
         }));

         expect(confirmation.dialogs[0]?.ownerDepth).toBeGreaterThanOrEqual(2);
         await invoke(findControl(confirmation, 'invoke', [ 'yes', 'accept', 'primary' ]));
         await waitFor({ type: 'text', value: 'Save result:', timeout: 3000 });

         const result = await executeJavaScript({ script: 'return document.querySelector("#dialog-result")?.textContent' });

         expect(result).toContain('existing.txt');
      } finally {
         await rm(fixtureDirectory, { recursive: true, force: true });
      }
   }, TIMEOUT);

   it('cancels Open and Save dialogs', async () => {
      const openSnapshot = await openDialog('#dialog-open');

      await invoke(findControl(openSnapshot, 'invoke', [ 'cancel' ]));
      await waitFor({ type: 'text', value: 'Open result: Cancelled', timeout: 3000 });

      const saveSnapshot = await openDialog('#dialog-save');

      await invoke(findControl(saveSnapshot, 'invoke', [ 'cancel' ]));
      await waitFor({ type: 'text', value: 'Save result: Cancelled', timeout: 3000 });
   }, TIMEOUT);

   it('fails safely for stale references and no-dialog timeouts', async () => {
      const snapshot = await openDialog('#dialog-message'),
            control = findControl(snapshot, 'invoke', [ 'accept', 'close' ]);

      await invoke(control);
      await expect(invoke(control)).rejects.toThrow('Stale native dialog element reference');
      await expect(snapshotNativeDialog({ timeoutMs: 500 })).rejects.toThrow(
         'No native dialog owned by the targeted Tauri window'
      );
   }, TIMEOUT);
});

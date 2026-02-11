import { invoke } from '@tauri-apps/api/core';
import { message, ask, confirm, open, save } from '@tauri-apps/plugin-dialog';

let greetInputEl: HTMLInputElement | null,
    greetMsgEl: HTMLElement | null;

async function greet(): Promise<void> {
   if (greetMsgEl && greetInputEl) {
      greetMsgEl.textContent = await invoke('greet', {
         name: greetInputEl.value,
      });
   }
}

function showDialogResult(dialogResult: HTMLElement, text: string): void {
   if (dialogResult) {
      dialogResult.textContent = text;
   }
}

window.addEventListener('DOMContentLoaded', () => {
   greetInputEl = document.querySelector('#greet-input');
   greetMsgEl = document.querySelector('#greet-msg');
   document.querySelector('#greet-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      greet();
   });

   const dialogResult = document.querySelector('#dialog-result') as HTMLElement;

   document.querySelector('#dialog-message')?.addEventListener('click', () => {
      message('This is a test message from the demo app.', { title: 'MCP Dialog Test', kind: 'info' })
         .then(() => {
            showDialogResult(dialogResult, 'Message dialog closed.');
         });
   });

   document.querySelector('#dialog-ask')?.addEventListener('click', () => {
      ask('Do you want to proceed with this action?', { title: 'MCP Dialog Test', kind: 'warning' })
         .then((answer) => {
            showDialogResult(dialogResult, `Ask result: ${answer ? 'Yes' : 'No'}`);
         });
   });

   document.querySelector('#dialog-confirm')?.addEventListener('click', () => {
      confirm('Are you sure you want to continue?', { title: 'MCP Dialog Test', kind: 'info' })
         .then((confirmed) => {
            showDialogResult(dialogResult, `Confirm result: ${confirmed ? 'Ok' : 'Cancel'}`);
         });
   });

   document.querySelector('#dialog-open')?.addEventListener('click', () => {
      open({ multiple: false, directory: false })
         .then((file) => {
            showDialogResult(dialogResult, `Open result: ${file ?? 'Cancelled'}`);
         });
   });

   document.querySelector('#dialog-save')?.addEventListener('click', () => {
      save({ defaultPath: 'untitled.txt' })
         .then((path) => {
            showDialogResult(dialogResult, `Save result: ${path ?? 'Cancelled'}`);
         });
   });
});

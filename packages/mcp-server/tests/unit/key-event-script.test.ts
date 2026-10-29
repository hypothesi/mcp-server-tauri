import { describe, it, expect } from 'vitest';
import { buildKeyEventScript } from '../../src/driver/scripts/index';

interface DispatchedEvent {
   type: string;
   init: KeyboardEventInit;
}

/**
 * Run a generated key event script against a stub document and return the
 * events it dispatched.
 */
function runKeyEventScript(script: string): DispatchedEvent[] {
   const dispatched: DispatchedEvent[] = [];

   class StubKeyboardEvent {
      public readonly type: string;
      public readonly init: KeyboardEventInit;

      public constructor(type: string, init: KeyboardEventInit) {
         this.type = type;
         this.init = init;
      }
   }

   const target = {
      dispatchEvent: (event: StubKeyboardEvent): boolean => {
         dispatched.push({ type: event.type, init: event.init });
         return true;
      },
   };

   // eslint-disable-next-line no-new-func
   new Function('document', 'KeyboardEvent', `return ${script.trim()}`)({ activeElement: target, body: target }, StubKeyboardEvent);

   return dispatched;
}

const KEY_CODES: readonly (readonly [ string, string ])[] = [
   [ '2', 'Digit2' ],
   [ '0', 'Digit0' ],
   [ 'k', 'KeyK' ],
   [ 'K', 'KeyK' ],
   [ ' ', 'Space' ],
   [ 'Enter', 'Enter' ],
   [ 'ArrowUp', 'ArrowUp' ],
   [ 'Escape', 'Escape' ],
];

describe('buildKeyEventScript', () => {
   it.each(KEY_CODES)('dispatches key %j with code %j', (key, code) => {
      const events = runKeyEventScript(buildKeyEventScript('press', key));

      expect(events.map((e) => { return e.type; })).toEqual([ 'keydown', 'keypress', 'keyup' ]);

      for (const event of events) {
         expect(event.init.key).toBe(key);
         expect(event.init.code).toBe(code);
      }
   });

   it('keeps the modifiers on a digit shortcut', () => {
      const [ keydown ] = runKeyEventScript(buildKeyEventScript('down', '1', [ 'Meta', 'Shift' ]));

      expect(keydown.init).toMatchObject({ key: '1', code: 'Digit1', metaKey: true, shiftKey: true, ctrlKey: false, altKey: false });
   });
});

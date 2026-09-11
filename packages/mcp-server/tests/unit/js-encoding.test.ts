import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

import { buildKeyEventScript } from '../../src/driver/scripts/index.js';

const CONCAT_PAYLOAD = '\'+(pwned=true)+\'';

const COMMENT_PAYLOAD = '\';pwned=true;//';

const BREAKOUT_PAYLOADS = [ CONCAT_PAYLOAD, COMMENT_PAYLOAD ];

interface EvalReplicaResult {
   pwned: boolean;
   result: unknown;
   error?: string;
}

function evalKeyEventScript(script: string): EvalReplicaResult {
   const sandbox = {
      pwned: false,
      document: {
         activeElement: {
            dispatchEvent() {
               return true;
            },
         },
         body: {
            dispatchEvent() {
               return true;
            },
         },
      },
      KeyboardEvent: function KeyboardEvent() {
         return {};
      },
   };

   try {
      const result = runInNewContext(script, sandbox, { timeout: 500 });

      return {
         pwned: sandbox.pwned,
         result,
      };
   } catch(error: unknown) {
      return {
         pwned: sandbox.pwned,
         result: undefined,
         error: error instanceof Error ? error.message : String(error),
      };
   }
}

describe('buildKeyEventScript JS encoding', () => {
   it('encodes a benign key as a JSON string and runs the intended path', () => {
      const script = buildKeyEventScript('press', 'Enter', [ 'Control' ]);

      const replica = evalKeyEventScript(script);

      expect(replica.pwned).toBe(false);
      expect(replica.error).toBeUndefined();
      expect(replica.result).toBe('Pressed key: Enter with Control');
      expect(script).toContain('const action = "press"');
      expect(script).toContain('const key = "Enter"');
      expect(script).toContain('const modifiers = ["Control"]');
   });

   it.each(BREAKOUT_PAYLOADS)('does not execute attacker statements from key %j', (key) => {
      const script = buildKeyEventScript('press', key);

      const replica = evalKeyEventScript(script);

      expect(replica.pwned).toBe(false);
      expect(replica.error).toBeUndefined();
      expect(replica.result).toBe(`Pressed key: ${key}`);
      expect(script).toContain(`const key = ${JSON.stringify(key)}`);
      expect(script).not.toContain(`const key = '${key}'`);
   });

   it.each(BREAKOUT_PAYLOADS)('does not execute attacker statements from action %j', (action) => {
      const script = buildKeyEventScript(action, 'Enter');

      const replica = evalKeyEventScript(script);

      expect(replica.pwned).toBe(false);
      expect(replica.error).toContain(`Unknown action: ${action}`);
      expect(script).toContain(`const action = ${JSON.stringify(action)}`);
      expect(script).not.toContain(`const action = '${action}'`);
   });
});

import { ListToolsResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { describe, expect, it } from 'vitest';

import { getCliToolDefinitions } from '../../src/server';

describe('tool input schemas', () => {
   // An MCP client parses the whole list at once, so one schema that is not an
   // object schema makes every tool unavailable.
   it('produce a tool list that the MCP SDK client schema accepts', () => {
      const result = ListToolsResultSchema.safeParse({ tools: getCliToolDefinitions() });

      expect(result.error?.issues).toBeUndefined();
      expect(result.success).toBe(true);
   });
});

import { describe, expect, it } from 'vitest';
import { ReadLogsSchema } from '../../src/monitor/logs';

describe('Read Logs Schema', () => {
   it('should default to 50 lines', () => {
      expect(ReadLogsSchema.parse({ source: 'console' }).lines).toBe(50);
   });

   it.each([ 0, -1, 1.5 ])('should reject an invalid line limit of %s', (lines) => {
      expect(() => { return ReadLogsSchema.parse({ source: 'console', lines }); }).toThrow();
   });
});

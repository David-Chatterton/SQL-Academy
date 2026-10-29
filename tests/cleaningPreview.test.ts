import { expect, it } from 'vitest';
import { distinctStatement, normalisedStatement, parseStatementDate, parseStatementPence } from '../src/engine/cleaningPreview';
it('parses explicit calendar dates and exact signed pence without inventing zero amounts', () => {
  expect(parseStatementDate('02/01/2025')).toBe('2025-01-02');
  expect(parseStatementDate('31/02/2025')).toBeNull();
  expect(parseStatementDate('29/02/2024')).toBe('2024-02-29');
  expect(parseStatementDate('29/02/2025')).toBeNull();
  expect(parseStatementPence('-30.01')).toBe(-3001);
  expect(parseStatementPence('12.50')).toBe(1250);
  expect(parseStatementPence('0')).toBe(0);
  expect(parseStatementPence('unknown')).toBeNull();
  expect(parseStatementPence('')).toBeNull();
});
it('reconciles the supplied source, rejects and business duplicates while retaining similar purchases', () => {
  const rows = normalisedStatement();
  expect(rows).toHaveLength(12);
  expect(rows.filter(row => row.reason).map(row => row.sourceRow)).toEqual([6, 7, 8, 11, 12]);
  expect(rows[3].categoryName).toBe('UNCATEGORISED');
  expect(rows[7].payeeName).toBeNull();
  expect(distinctStatement()).toHaveLength(6);
  expect(distinctStatement().filter(row => row.payeeName === 'FRESH MARKET').map(row => row.reference)).toEqual(['TX-001', 'TX-009']);
});

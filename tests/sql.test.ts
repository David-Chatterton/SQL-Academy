import { describe, expect, it } from 'vitest';
import { assertReadOnly, hasTechnique, tokens } from '../src/engine/sql';
import { lessons } from '../src/content/lessons';
describe('Module 1 read-only workflow', () => {
  it('allows all reference solutions and alternative comparisons', () => {
    for (const lesson of lessons) expect(() => assertReadOnly(lesson.solution, lesson.module === 4 ? 'cleaning' : 'finance')).not.toThrow();
    expect(() => assertReadOnly("select date, payee, amount from transactions where amount between -100 and -50;")).not.toThrow();
    expect(() => assertReadOnly("SELECT * FROM transactions WHERE (amount < -30); -- UPDATE data")).not.toThrow();
  });
  it('rejects destructive, stacked and external queries', () => {
    for (const sql of ["DELETE FROM transactions", "SELECT * FROM transactions; DROP TABLE transactions;", "SELECT * INTO stolen FROM transactions", "SELECT * FROM read_csv('data.csv')", "SELECT nextval('sequence')", "SELECT query('DELETE FROM transactions')", "SELECT * FROM read_parquet('remote')", "PRAGMA version", "SELECT * FROM transactions; SET enable_external_access = true;"]) expect(() => assertReadOnly(sql)).toThrow();
  });
  it('does not confuse comments or literals with techniques or statement separators', () => {
    expect(() => assertReadOnly("SELECT 'DELETE; FROM', 'it''s fine' FROM transactions;")).not.toThrow();
    expect(hasTechnique(tokens("SELECT 'ORDER BY' FROM transactions -- ORDER BY"), 'ORDER BY')).toBe(false);
    expect(hasTechnique(tokens('SELECT * FROM transactions ORDER /* comment */ BY amount'), 'ORDER BY')).toBe(true);
    expect(hasTechnique(tokens('SELECT category FROM transactions AS "DISTINCT" GROUP BY category'), 'DISTINCT')).toBe(false);
    expect(() => tokens("SELECT 'unterminated")).toThrow();
    expect(() => tokens('SELECT /* unclosed')).toThrow();
    expect(tokens('SELECT /* nested /* x */ comment */ amount FROM transactions')).toEqual(tokens('SELECT amount FROM transactions'));
  });
});

it('recognises equivalent outer-join techniques without accepting keywords in text', () => {
  expect(hasTechnique(tokens('SELECT t.id FROM transactions t LEFT OUTER JOIN categories c ON t.category_id = c.id'), 'LEFT JOIN')).toBe(true);
  expect(hasTechnique(tokens("SELECT 'LEFT OUTER JOIN' FROM transactions"), 'LEFT JOIN')).toBe(false);
});

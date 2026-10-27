import assert from 'node:assert/strict';
import { generateTransactions, money, nativeSeedSQL } from '../src/data/finance';
import { lessons } from '../src/content/lessons';
import { assertReadOnly, tokens, hasTechnique } from '../src/engine/sql';
import { decodeCell, validateResult } from '../src/engine/results';
import { emptyProgress, completeLesson, saveProgress, readProgress, clearProgress, recommendedLesson } from '../src/hooks/progress';
import type { QueryResult } from '../src/types';
const rows = generateTransactions();
assert.equal(rows.length, 10000); assert.deepEqual(rows, generateTransactions());
assert.notDeepEqual(rows, generateTransactions(42));
assert.equal(new Set(rows.map(r => r.id)).size, 10000);
assert(rows.every(r => Number.isInteger(r.pence) && r.date >= '2024-01-01' && r.date <= '2025-12-31'));
for (let id = 1; id <= 48; id++) {
  const pair = rows.filter(r => r.transferId === id); assert.equal(pair.length, 2); assert.equal(pair[0].pence + pair[1].pence, 0);
}
assert.equal(rows.filter(r => r.pence < -100000 && r.category !== 'Housing' && r.category !== 'Transfers').length, 3);
assert(rows.some(r => r.category === null)); assert(rows.some(r => r.duplicateOf !== null));
assert.equal(money(-1), '-0.01'); assert(nativeSeedSQL().includes('DECIMAL(12,2)'));
assert.equal(lessons.length, 16);
for (const lesson of lessons) {
  assertReadOnly(lesson.solution); assert.equal(lesson.hints.length, 3); assert(lesson.objectives.length);
  assert(lesson.explanation.length); assert(lesson.terminal); assert(lesson.solutionWhy);
}
for (const sql of ['DELETE FROM transactions', 'SELECT * FROM transactions; DROP TABLE transactions;', "SELECT * FROM read_csv('file.csv')", "SELECT query('DELETE FROM transactions')"]) assert.throws(() => assertReadOnly(sql));
assertReadOnly("SELECT 'DELETE; WHERE' FROM transactions;");
assert(!hasTechnique(tokens("SELECT 'DISTINCT' FROM transactions -- DISTINCT"), 'DISTINCT'));
assert.equal(decodeCell(new Int32Array([-1, -1, -1, -1]), 'Decimal', 2), '-0.01');
assert.equal(decodeCell(new Int32Array([12345, 0, 0, 0]), 'Decimal', 2), '123.45');
const result = (values: QueryResult['rows']): QueryResult => ({ columns: [{ name: 'amount', type: 'Decimal', numeric: true }], rows: values, elapsedMs: 0 });
const lesson = { ...lessons[0], expected: { ordered: false } };
assert(validateResult(result([[1], ['-0.01']]), result([['-0.01'], ['1.00']]), lesson, 'SELECT amount FROM transactions').ok);
assert(!validateResult(result([['0.01']]), result([['-0.01']]), lesson, 'SELECT amount FROM transactions').ok);
assert(!validateResult(result([[1], [1]]), result([[1], [2]]), lesson, 'SELECT amount FROM transactions').ok);
assert(!validateResult(result([[2], [1]]), result([[1], [2]]), { ...lesson, expected: { ordered: true } }, 'SELECT amount FROM transactions').ok);
const map = new Map<string, string>();
const storage = { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => { map.set(key, value); }, removeItem: (key: string) => { map.delete(key); } };
const progress = completeLesson(emptyProgress(), 'm1-1', '2026-01-01T00:00:00Z');
assert(saveProgress(storage, progress)); assert.deepEqual(readProgress(storage), progress); assert.equal(recommendedLesson(progress), 'm1-2');
storage.setItem('other-app', 'keep'); clearProgress(storage); assert.equal(storage.getItem('other-app'), 'keep');
console.log('PASS: deterministic dataset, transfer balancing, lesson completeness, SQL guards, decimal decoding, result validation and scoped progress persistence.');
console.log('This core check does not execute DuckDB-Wasm or verify the browser interface. Run Vitest and Playwright after installing dependencies.');

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import * as duckdb from '@duckdb/duckdb-wasm/blocking';
import { generateTransactions, nativeSeedSQL, seedStatements } from '../src/data/finance';
import { lessons } from '../src/content/lessons';
import { decodeTable, validateResult } from '../src/engine/results';
import { assertReadOnly } from '../src/engine/sql';
const require = createRequire(import.meta.url);
let database: Awaited<ReturnType<typeof duckdb.createDuckDB>>;
let connection: ReturnType<typeof database.connect>;
function run(sql: string) {
  assertReadOnly(sql);
  connection.query('BEGIN TRANSACTION');
  try { return decodeTable(connection.query(sql)); }
  finally { connection.query('ROLLBACK'); }
}
beforeAll(async () => {
  database = await duckdb.createDuckDB({
    mvp: { mainModule: require.resolve('@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm'), mainWorker: require.resolve('@duckdb/duckdb-wasm/dist/duckdb-node-mvp.worker.cjs') },
    eh: { mainModule: require.resolve('@duckdb/duckdb-wasm/dist/duckdb-eh.wasm'), mainWorker: require.resolve('@duckdb/duckdb-wasm/dist/duckdb-node-eh.worker.cjs') },
  }, new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING), duckdb.NODE_RUNTIME);
  await database.instantiate(() => {});
  database.open({ query: { castDecimalToDouble: false, castBigIntToDouble: false } });
  connection = database.connect();
  connection.query('BEGIN TRANSACTION');
  for (const statement of seedStatements()) connection.query(statement);
  connection.query('COMMIT');
  connection.query("SET memory_limit = '128MB'; SET enable_external_access = false; SET lock_configuration = true;");
}, 30000);
afterAll(() => { connection?.close(); database?.reset(); });
describe('real DuckDB-Wasm SQL integration under Node (browser worker is covered by Playwright)', () => {
  const counts = [10000, 10000, 265, 329, 410, 10, 13, 3];
  const alternatives = [
    'SELECT transactions.* FROM transactions;',
    'SELECT date, payee, amount FROM transactions WHERE TRUE;',
    "SELECT date, payee, category, amount FROM transactions WHERE amount < 0 AND ABS(amount) > 30 AND category = 'Groceries';",
    'SELECT date, payee, amount FROM transactions WHERE amount BETWEEN -100 AND -50;',
    "SELECT date, payee, category, amount FROM transactions WHERE (amount < -50 AND category = 'Restaurants') OR (amount < -30 AND category = 'Groceries');",
    "SELECT id, date, payee, amount FROM transactions WHERE category <> 'Transfers' AND amount < 0 ORDER BY amount, id LIMIT 10;",
    'SELECT DISTINCT category FROM transactions ORDER BY category;',
    "SELECT id, date, payee, category, amount FROM transactions WHERE category <> 'Housing' AND category <> 'Transfers' AND amount < -1000 ORDER BY amount, id;",
  ];
  for (const [index, lesson] of lessons.filter(lesson => lesson.module === 1).entries()) {
    it(`executes ${lesson.id} with its fixed row count and accepts alternative SQL`, () => {
      const expected = run(lesson.solution);
      expect(expected.rows).toHaveLength(counts[index]);
      expect(validateResult(run(alternatives[index]), expected, lesson, alternatives[index]).ok).toBe(true);
    });
  }
  it('decodes real Arrow dates and decimal pennies exactly', () => {
    const boundary = generateTransactions().find(row => row.pence === -3001 && row.category === 'Groceries')!;
    const actual = run(`SELECT date, amount FROM transactions WHERE id = ${boundary.id};`);
    expect(actual.rows).toEqual([['2024-01-02', '-30.01']]);
    expect(actual.columns[1].type).toContain('Decimal');
  });
  it('rejects incorrect inclusive boundaries and recovers after SQL errors', () => {
    const wrong = 'SELECT date, payee, amount FROM transactions WHERE amount > -100 AND amount < -50;';
    expect(validateResult(run(wrong), run(lessons[3].solution), lessons[3], wrong).ok).toBe(false);
    expect(() => run('SELECT missing_column FROM transactions;')).toThrow();
    expect(run('SELECT COUNT(*) AS total FROM transactions;').rows).toEqual([['10000']]);
    expect(() => connection.query("SELECT * FROM read_csv('untrusted.csv');")).toThrow();
  });
  it('resets the engine and reproduces the data using the downloaded native SQL seed', () => {
    const original = run(lessons[7].solution);
    connection.close(); database.reset();
    database.open({ query: { castDecimalToDouble: false, castBigIntToDouble: false } });
    connection = database.connect(); connection.query(nativeSeedSQL());
    expect(run('SELECT COUNT(*) AS total FROM transactions;').rows).toEqual([['10000']]);
    expect(run(lessons[7].solution).rows).toEqual(original.rows);
  });
});

describe('Module 2 aggregates against real DuckDB', () => {
  const transactions = generateTransactions();
  const groceries = transactions.filter(row => row.category === 'Groceries' && row.pence < 0);
  const total = (rows: typeof transactions) => -rows.reduce((sum, row) => sum + row.pence, 0);
  const cash = (pence: number) => (pence / 100).toFixed(2);
  const module2 = lessons.filter(lesson => lesson.module === 2);
  for (const lesson of module2) {
    it(`executes and validates ${lesson.id}, rejecting an altered result`, () => {
      const expected = run(lesson.solution);
      expect(expected.rows.length).toBeGreaterThan(0);
      expect(validateResult(expected, expected, lesson, lesson.solution).ok).toBe(true);
      const wrong = { ...expected, rows: expected.rows.map((row, i) => i ? row : row.map((cell, col) => col === row.length - 1 ? null : cell)) };
      expect(validateResult(wrong, expected, lesson, lesson.solution).ok).toBe(false);
    });
  }
  it('counts missing categories without losing rows and sums exact pennies', () => {
    const missing = transactions.filter(row => row.category === null).length;
    expect(run(module2[0].solution).rows).toEqual([['10000', String(10000 - missing), String(missing)]]);
    expect(run(module2[1].solution).rows).toEqual([[cash(total(groceries))]]);
    expect(run(module2[2].solution).rows.map(row => row.map(Number))).toEqual([[
      Number((total(groceries) / groceries.length / 100).toFixed(2)),
      Math.min(...groceries.map(row => -row.pence)) / 100,
      Math.max(...groceries.map(row => -row.pence)) / 100,
    ]]);
  });
  it('retains the NULL spending group and accepts equivalent positive sums', () => {
    const expected = run(module2[3].solution);
    const missing = transactions.filter(row => row.category === null && row.pence < 0);
    expect(expected.rows).toContainEqual([null, String(missing.length), cash(total(missing))]);
    const alternative = module2[3].solution.replace('-SUM(amount)', 'SUM(-amount)');
    expect(validateResult(run(alternative), expected, module2[3], alternative).ok).toBe(true);
    const wrong = module2[3].solution.replace("(category <> 'Transfers' OR category IS NULL)", "category <> 'Transfers'");
    expect(validateResult(run(wrong), expected, module2[3], wrong).ok).toBe(false);
  });
  it('applies HAVING to totals rather than individual purchases', () => {
    const lesson = module2[5], expected = run(lesson.solution);
    expect(expected.rows.every(row => Number(row[1]) > 20000)).toBe(true);
    const wrong = lesson.solution.replace('amount < 0', 'amount < -20000');
    expect(validateResult(run(wrong), expected, lesson, wrong).ok).toBe(false);
    const alias = lesson.solution.replace('HAVING -SUM(amount)', 'HAVING total_spending');
    expect(validateResult(run(alias), expected, lesson, alias).ok).toBe(true);
    // A one-row boundary proves strict and inclusive group thresholds differ.
    expect(run('SELECT COUNT(*) AS n FROM transactions WHERE id = 1 HAVING COUNT(*) > 1;').rows).toHaveLength(0);
    expect(run('SELECT COUNT(*) AS n FROM transactions WHERE id = 1 HAVING COUNT(*) >= 1;').rows).toEqual([['1']]);
  });
  it('separates inflows, outflows and signed net movement by account', () => {
    const expected = run(module2[6].solution);
    for (const row of expected.rows) {
      const input = transactions.filter(item => item.accountId === Number(row[0]) && item.category !== 'Transfers');
      const incoming = input.filter(item => item.pence > 0).reduce((sum, item) => sum + item.pence, 0);
      const outgoing = total(input.filter(item => item.pence < 0));
      expect(row.slice(1)).toEqual([cash(incoming), cash(outgoing), cash(incoming - outgoing)]);
    }
    expect(expected.rows.map(row => Number(row[0]))).toEqual([1, 2, 4]);
  });
  it('matches the final report to an independent 2025 calculation and rejects year/filter errors', () => {
    const lesson = module2[7], expected = run(lesson.solution);
    const groups = new Map<string, typeof transactions>();
    for (const row of transactions) {
      if (!row.date.startsWith('2025') || row.pence >= 0 || row.category === null || row.category === 'Transfers') continue;
      groups.set(row.category, [...(groups.get(row.category) ?? []), row]);
    }
    const report = [...groups].filter(([, rows]) => rows.length >= 100 && total(rows) > 500000)
      .sort(([a, ar], [b, br]) => total(br) - total(ar) || a.localeCompare(b))
      .map(([category, rows]) => [category, rows.length, total(rows) / 100, Number((total(rows) / rows.length / 100).toFixed(2))]);
    expect(expected.rows.map(row => row.map((cell, i) => i ? Number(cell) : cell))).toEqual(report);
    for (const wrong of [lesson.solution.replace("date >= '2025-01-01'", "date >= '2024-01-01'"), lesson.solution.replace('HAVING COUNT(*) >= 100 AND -SUM(amount) > 5000', 'HAVING COUNT(*) >= 1')]) {
      expect(validateResult(run(wrong), expected, lesson, wrong).ok).toBe(false);
    }
  });
  it('produces the same Module 2 reports from the downloadable native seed', () => {
    const reports = module2.map(lesson => run(lesson.solution).rows);
    connection.close(); database.reset();
    database.open({ query: { castDecimalToDouble: false, castBigIntToDouble: false } });
    connection = database.connect(); connection.query(nativeSeedSQL());
    for (const [index, lesson] of module2.entries()) expect(run(lesson.solution).rows).toEqual(reports[index]);
  });
});

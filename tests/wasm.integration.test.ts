import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import * as duckdb from '@duckdb/duckdb-wasm/blocking';
import { accounts, categories, payees, money, generateTransactions, nativeSeedSQL, seedStatements } from '../src/data/finance';
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

describe('Module 3 relational queries against real DuckDB', () => {
  const transactions = generateTransactions();
  const module3 = lessons.filter(lesson => lesson.module === 3);
  const categoryName = (id: number | null) => id === null ? null : categories[id - 1];
  const outflows2025 = transactions.filter(row => row.date.startsWith('2025') && row.pence < 0);
  const groups = new Map<string, typeof transactions>();
  for (const row of outflows2025) {
    if (categoryName(row.categoryId) === 'Transfers') continue;
    const key = JSON.stringify([row.accountId, categoryName(row.categoryId) ?? 'Uncategorised']);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const report = [...groups].map(([key, rows]) => {
    const [id, category] = JSON.parse(key) as [number, string];
    return { id, category, count: rows.length, pence: -rows.reduce((sum, row) => sum + row.pence, 0) };
  }).sort((a, b) => b.pence - a.pence || a.id - b.id || a.category.localeCompare(b.category))
    .map(row => [row.id, accounts.find(account => account.id === row.id)!.name, row.category, String(row.count), money(row.pence)]);
  const expectedRows = [
    accounts.map(account => [account.id, account.name, account.type, 'GBP']),
    transactions.map(row => [row.id, row.date, accounts.find(account => account.id === row.accountId)!.name, money(row.pence)]),
    transactions.map(row => [row.id, accounts.find(account => account.id === row.accountId)!.name, payees.find(payee => payee.id === row.payeeId)!.name, money(row.pence)]),
    transactions.map(row => [row.id, row.categoryId, categoryName(row.categoryId), money(row.pence)]),
    transactions.filter(row => row.categoryId === null).map(row => [row.id, row.date, row.payee, money(row.pence)]),
    categories.map((name, i) => [i + 1, name, String(outflows2025.filter(row => row.categoryId === i + 1).length)]),
    accounts.map(account => {
      const rows = transactions.filter(row => row.accountId === account.id && row.pence < 0 && row.category !== 'Transfers');
      return [account.id, account.name, String(rows.length), money(-rows.reduce((sum, row) => sum + row.pence, 0))];
    }),
    report,
  ];
  for (const [index, lesson] of module3.entries()) {
    it(`matches ${lesson.id} to independently calculated seeded records`, () => {
      const actual = run(lesson.solution);
      expect(actual.rows).toEqual(expectedRows[index]);
      expect(validateResult(actual, actual, lesson, lesson.solution).ok).toBe(true);
      const altered = { ...actual, rows: actual.rows.slice(1) };
      expect(validateResult(altered, actual, lesson, lesson.solution).ok).toBe(false);
    });
  }
  it('accepts equivalent joins and rejects the wrong relationship or payee text', () => {
    for (const index of [1, 3, 4, 5, 6, 7]) {
      const lesson = module3[index];
      const alternative = lesson.solution.replaceAll('INNER JOIN', 'JOIN').replaceAll('LEFT JOIN', 'LEFT OUTER JOIN');
      expect(validateResult(run(alternative), run(lesson.solution), lesson, alternative).ok).toBe(true);
    }
    const account = module3[1];
    const wrongKey = account.solution.replace('t.account_id = a.id', 't.id = a.id');
    expect(validateResult(run(wrongKey), run(account.solution), account, wrongKey).ok).toBe(false);
    const payee = module3[2];
    for (const wrong of [payee.solution.replace('t.payee_id = p.id', 't.payee = p.name'), payee.solution.replace('p.name AS payee_name', 't.payee AS payee_name')]) {
      expect(validateResult(run(wrong), run(payee.solution), payee, wrong).ok).toBe(false);
    }
  });
  it('distinguishes missing category relationships from matches', () => {
    const lesson = module3[3], expected = run(lesson.solution);
    const inner = lesson.solution.replace('LEFT JOIN', 'INNER JOIN');
    expect(validateResult(run(inner), expected, lesson, inner).ok).toBe(false);
    const missing = module3[4];
    const wrongNull = missing.solution.replace('c.id IS NULL', 'c.id = NULL');
    expect(run(wrongNull).rows).toHaveLength(0);
    const inferredCategory = lesson.solution.replace('t.category_id = c.id', 't.payee_id = c.id');
    expect(validateResult(run(inferredCategory), expected, lesson, inferredCategory).ok).toBe(false);
  });
  it('keeps zero-activity categories and rejects WHERE and COUNT(*) mistakes', () => {
    const lesson = module3[5], expected = run(lesson.solution);
    expect(expected.rows).toHaveLength(12);
    expect(expected.rows.filter(row => row[2] === '0').map(row => row[1])).toEqual(['Salary', 'Refunds']);
    const where = lesson.solution.replace('  AND t.amount < 0', 'WHERE t.amount < 0');
    const count = lesson.solution.replace('COUNT(t.id)', 'COUNT(*)');
    for (const wrong of [where, count]) expect(validateResult(run(wrong), expected, lesson, wrong).ok).toBe(false);
  });
  it('retains the savings account with exact zero totals and excludes transfer amounts', () => {
    const lesson = module3[6], expected = run(lesson.solution);
    expect(expected.rows).toContainEqual([3, 'Rainy day savings', '0', '0.00']);
    for (const wrong of [lesson.solution.replace('COUNT(t.id)', 'COUNT(*)'), lesson.solution.replace('COALESCE(-SUM(t.amount), 0)', '-SUM(t.amount)'), lesson.solution.replace('LEFT JOIN', 'INNER JOIN'), lesson.solution.replace("AND (t.category <> 'Transfers' OR t.category IS NULL)", '')]) {
      expect(validateResult(run(wrong), expected, lesson, wrong).ok).toBe(false);
    }
  });
  it('rejects final reports that lose NULL categories, include transfers or use the wrong year', () => {
    const lesson = module3[7], expected = run(lesson.solution);
    expect(expected.rows.some(row => row[2] === 'Uncategorised')).toBe(true);
    expect(expected.rows.every(row => row[2] !== 'Transfers')).toBe(true);
    for (const wrong of [lesson.solution.replace('LEFT JOIN', 'INNER JOIN'), lesson.solution.replace("OR c.id IS NULL", ''), lesson.solution.replace("date >= '2025-01-01'", "date >= '2024-01-01'"), lesson.solution.replace("AND (c.name <> 'Transfers' OR c.id IS NULL)", '')]) {
      expect(validateResult(run(wrong), expected, lesson, wrong).ok).toBe(false);
    }
  });
  it('enforces parent primary keys and transaction foreign keys in the real schema', () => {
    for (const sql of ["INSERT INTO categories VALUES (1, 'Duplicate key');", "INSERT INTO categories VALUES (NULL, 'Missing key');", 'UPDATE transactions SET category_id = 999 WHERE id = 1;']) {
      connection.query('BEGIN TRANSACTION');
      try { expect(() => connection.query(sql)).toThrow(); }
      finally { connection.query('ROLLBACK'); }
    }
    expect(run(module3[0].solution).rows).toHaveLength(4);
  });
  it('reproduces all joined reports from the downloaded native seed', () => {
    const reports = module3.map(lesson => run(lesson.solution).rows);
    connection.close(); database.reset();
    database.open({ query: { castDecimalToDouble: false, castBigIntToDouble: false } });
    connection = database.connect(); connection.query(nativeSeedSQL());
    for (const [index, lesson] of module3.entries()) expect(run(lesson.solution).rows).toEqual(reports[index]);
  });
});

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as duckdb from '@duckdb/duckdb-wasm/blocking';
import { statementRows, statementCSV, rawStatementSQL, cleanCandidatesSQL, parquetFixtureSQL, cleaningSecuritySQL, cleaningNativeSetup } from '../src/data/cleaning';
import { module4Lessons } from '../src/content/module4';
import { distinctStatement, normalisedStatement } from '../src/engine/cleaningPreview';
import { money } from '../src/data/finance';
import { decodeTable, validateResult } from '../src/engine/results';
import { assertReadOnly } from '../src/engine/sql';
const require = createRequire(import.meta.url);
const directory = mkdtempSync(join(tmpdir(), 'academy-cleaning-'));
const parquetPath = join(directory, 'statement.parquet');
const nativeOutput = (sql: string) => sql.replace("TO 'statement.parquet'", `TO '${parquetPath}'`);
let database: Awaited<ReturnType<typeof duckdb.createDuckDB>>;
let connection: ReturnType<typeof database.connect>;
function run(sql: string) {
  assertReadOnly(sql, 'cleaning');
  connection.query('BEGIN TRANSACTION');
  try { return decodeTable(connection.query(sql)); }
  finally { connection.query('ROLLBACK'); }
}
beforeAll(async () => {
  // Only extension transport is replaced: the signed local binary is loaded by the real engine.
  vi.stubGlobal('XMLHttpRequest', class {
    status = 200; response: ArrayBuffer = new ArrayBuffer(0); url = '';
    open(_method: string, url: string) { this.url = url; }
    send() {
      const platform = /\/(wasm_eh|wasm_mvp)\/parquet\.duckdb_extension\.wasm$/.exec(this.url)?.[1];
      if (!platform || !this.url.includes('/v1.4.3/')) throw new Error(`Unexpected extension request: ${this.url}`);
      const bytes = readFileSync(new URL(`../public/duckdb-extensions/duckdb-wasm/v1.4.3/${platform}/parquet.duckdb_extension.wasm`, import.meta.url));
      this.response = new Uint8Array(bytes).buffer;
    }
  });
  database = await duckdb.createDuckDB({
    mvp: { mainModule: require.resolve('@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm'), mainWorker: require.resolve('@duckdb/duckdb-wasm/dist/duckdb-node-mvp.worker.cjs') },
    eh: process.env.ACADEMY_WASM_MVP === '1' ? undefined : { mainModule: require.resolve('@duckdb/duckdb-wasm/dist/duckdb-eh.wasm'), mainWorker: require.resolve('@duckdb/duckdb-wasm/dist/duckdb-node-eh.worker.cjs') },
  }, new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING), duckdb.NODE_RUNTIME);
  await database.instantiate(() => {});
  database.open({ query: { castDecimalToDouble: false, castBigIntToDouble: false } });
  database.registerFileText('statement.csv', statementCSV());
  connection = database.connect();
  connection.query(rawStatementSQL); connection.query(cleanCandidatesSQL); connection.query(nativeOutput(parquetFixtureSQL));
  database.registerFileBuffer('statement.parquet', new Uint8Array(readFileSync(parquetPath)));
  connection.query(cleaningSecuritySQL);
}, 30000);
afterAll(() => { connection?.close(); database?.reset(); vi.unstubAllGlobals(); rmSync(directory, { recursive: true, force: true }); });
describe('isolated cleaning workspace and real virtual files', () => {
  it('reads only the registered CSV and Parquet with external access disabled', () => {
    expect(run("SELECT COUNT(*) AS n FROM read_csv('statement.csv', header = true, all_varchar = true);").rows).toEqual([['12']]);
    expect(run("SELECT COUNT(*) AS n FROM read_parquet('statement.parquet');").rows).toEqual([['3']]);
    expect(() => connection.query("SELECT * FROM read_csv('/etc/passwd');")).toThrow();
    expect(() => connection.query("SELECT * FROM read_parquet('https://example.com/file.parquet');")).toThrow();
    expect(() => run('SELECT * FROM transactions;')).toThrow();
  });
});

describe('Module 4 lessons against the real SQL engine', () => {
  const normal = normalisedStatement(), distinct = distinctStatement();
  const expectedRows = [
    statementRows.map(row => [String(row.sourceRow), row.postedOn || null, row.payee, row.category, row.amount || null, row.reference]),
    statementRows.filter(row => [1, 3, 5].includes(row.sourceRow)).map(row => [row.sourceRow, normal.find(item => item.sourceRow === row.sourceRow)!.postedDate, row.payee, row.amount]),
    statementRows.map(row => [row.sourceRow, row.amount || null, normal.find(item => item.sourceRow === row.sourceRow)!.pence === null ? null : money(normal.find(item => item.sourceRow === row.sourceRow)!.pence!)]),
    statementRows.map(row => [row.sourceRow, row.postedOn || null, normal.find(item => item.sourceRow === row.sourceRow)!.postedDate]),
    normal.map(row => [row.sourceRow, row.payeeName, row.categoryName]),
    [[6, 'TX-005', 'invalid_or_missing_date'], [7, 'TX-006', 'invalid_or_missing_amount'], [8, 'TX-007', 'missing_payee'], [11, 'TX-010', 'invalid_or_missing_date'], [12, 'TX-011', 'invalid_or_missing_amount']],
    distinct.map(row => [row.postedDate, row.payeeName, row.categoryName, money(row.pence!), row.reference]),
    [['GROCERIES', '2', '60.02'], ['UNCATEGORISED', '1', '15.99'], ['TRANSPORT', '1', '5.50']],
  ];
  for (const [index, lesson] of module4Lessons.entries()) {
    it(`matches ${lesson.id} to independently calculated fixture records`, () => {
      const actual = run(lesson.solution);
      expect(actual.rows).toEqual(expectedRows[index]);
      expect(validateResult(actual, actual, lesson, lesson.solution).ok).toBe(true);
      expect(validateResult({ ...actual, rows: actual.rows.slice(1) }, actual, lesson, lesson.solution).ok).toBe(false);
    });
  }
  it('preserves actual CSV text and Parquet DATE and DECIMAL types', () => {
    const raw = run(module4Lessons[0].solution);
    expect(raw.columns.every(column => column.type.includes('Utf8'))).toBe(true);
    const typed = run(module4Lessons[1].solution);
    expect(typed.columns[0].numeric).toBe(true);
    expect(typed.columns[1].type).toContain('Date');
    expect(typed.columns[3].type).toContain('Decimal');
    const bytes = database.copyFileToBuffer('statement.parquet');
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe('PAR1');
    expect(new TextDecoder().decode(bytes.slice(-4))).toBe('PAR1');
  });
  it('keeps failed casts visible and rejects a zero replacement or guessed date format', () => {
    const lesson = module4Lessons[2], expected = run(lesson.solution);
    expect(expected.rows.filter(row => row[2] === null).map(row => row[0])).toEqual([7, 12]);
    const zero = lesson.solution.replace('TRY_CAST(TRIM(amount) AS DECIMAL(12,2))', 'COALESCE(TRY_CAST(TRIM(amount) AS DECIMAL(12,2)), 0)');
    expect(validateResult(run(zero), expected, lesson, zero).ok).toBe(false);
    expect(() => run(lesson.solution.replace('TRY_CAST', 'CAST'))).toThrow();
    const date = module4Lessons[3];
    const wrong = date.solution.replace('%d/%m/%Y', '%m/%d/%Y');
    expect(validateResult(run(wrong), run(date.solution), date, wrong).ok).toBe(false);
    expect(run('SELECT COUNT(*) AS n FROM raw_statement;').rows).toEqual([['12']]);
  });
  it('accepts equivalent valid SQL but rejects missing standardisation and duplicate inflation', () => {
    const alternatives = [
      [module4Lessons[4], module4Lessons[4].solution.replace('UPPER(TRIM(payee))', 'TRIM(UPPER(payee))')],
      [module4Lessons[7], module4Lessons[7].solution.replace('-SUM(amount)', 'SUM(-amount)')],
    ] as const;
    for (const [lesson, sql] of alternatives) expect(validateResult(run(sql), run(lesson.solution), lesson, sql).ok).toBe(true);
    for (const [lesson, sql] of [
      [module4Lessons[4], module4Lessons[4].solution.replaceAll('UPPER(TRIM', 'LOWER(TRIM')],
      [module4Lessons[6], module4Lessons[6].solution.replace('DISTINCT ', '')],
      [module4Lessons[7], module4Lessons[7].solution.replace('DISTINCT ', '')],
      [module4Lessons[7], module4Lessons[7].solution.replace("AND category_name <> 'TRANSFERS'", '')],
    ] as const) expect(validateResult(run(sql), run(lesson.solution), lesson, sql).ok).toBe(false);
    expect(distinct.map(row => row.reference)).toContain('TX-009');
    expect(run(module4Lessons[7].solution).rows.reduce((sum, row) => sum + Number(row[1]), 0)).toBe(4);
  });
  it('rejects unsafe file readers, mutations and configuration changes in cleaning mode', () => {
    for (const sql of ["SELECT * FROM read_csv('other.csv')", "SELECT * FROM read_csv('https://example.com/file.csv')", "SELECT * FROM read_csv('statement.csv' || '.other')", "SELECT * FROM read_csv('statement.csv', store_rejects = true)", "SELECT * FROM read_parquet('statement.csv')", 'DELETE FROM raw_statement', 'SELECT 1; SET enable_external_access = true;']) {
      expect(() => run(sql)).toThrow();
    }
    expect(() => connection.query("SELECT * FROM 'unlisted.csv';")).toThrow();
    expect(() => connection.query('SET enable_external_access = true;')).toThrow();
    expect(run('SELECT COUNT(*) AS n FROM raw_statement;').rows).toEqual([['12']]);
  });
  it('recreates identical query results from the downloadable CSV and native setup', () => {
    const original = module4Lessons.map(lesson => run(lesson.solution).rows);
    connection.close(); database.reset();
    database.open({ query: { castDecimalToDouble: false, castBigIntToDouble: false } });
    connection = database.connect();
    connection.query(nativeOutput(cleaningNativeSetup()));
    database.registerFileBuffer('statement.parquet', new Uint8Array(readFileSync(parquetPath)));
    connection.query(cleaningSecuritySQL);
    for (const [index, lesson] of module4Lessons.entries()) expect(run(lesson.solution).rows).toEqual(original[index]);
  });
});

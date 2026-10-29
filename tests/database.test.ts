import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ query: vi.fn(), close: vi.fn(), instantiate: vi.fn(), open: vi.fn(), terminate: vi.fn(), workerTerminate: vi.fn(), registerFileText: vi.fn(), copyFileToBuffer: vi.fn() }));
vi.mock('@duckdb/duckdb-wasm', () => ({
  selectBundle: async () => ({ mainModule: 'module.wasm', mainWorker: 'worker.js', pthreadWorker: null }),
  ConsoleLogger: class {}, LogLevel: { WARNING: 3 },
  AsyncDuckDB: class {
    instantiate = mocks.instantiate; open = mocks.open; terminate = mocks.terminate; registerFileText = mocks.registerFileText; copyFileToBuffer = mocks.copyFileToBuffer;
    async connect() { return { query: mocks.query, close: mocks.close }; }
  },
}));
import { AcademyDatabase } from '../src/engine/database';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.query.mockResolvedValue({ schema: { fields: [{ name: 'id', type: { toString: () => 'Int32' } }] }, numRows: 1, getChildAt: () => ({ get: () => 1 }) });
  mocks.instantiate.mockResolvedValue(null); mocks.open.mockResolvedValue(null); mocks.close.mockResolvedValue(null); mocks.terminate.mockResolvedValue(null);
  vi.stubGlobal('Worker', class { terminate = mocks.workerTerminate; });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe('DuckDB adapter lifecycle (mocked bindings; real browser tested by Playwright)', () => {
  it('seeds the schema and all data batches before accepting queries', async () => {
    const database = new AcademyDatabase(); await database.initialise();
    expect(mocks.instantiate).toHaveBeenCalled();
    expect(mocks.query.mock.calls.filter(([sql]) => String(sql).startsWith('INSERT INTO transactions'))).toHaveLength(20);
    expect(mocks.query.mock.calls.some(([sql]) => String(sql).includes('enable_external_access = false'))).toBe(true);
    mocks.query.mockClear();
    const result = await database.query('SELECT id FROM transactions;');
    expect(result.rows).toEqual([[1]]);
    expect(mocks.query.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN TRANSACTION', 'SELECT id FROM transactions;', 'ROLLBACK']);
    await database.dispose(); expect(mocks.close).toHaveBeenCalled(); expect(mocks.terminate).toHaveBeenCalled();
  });
  it('rolls back syntax failures and allows the next query', async () => {
    const database = new AcademyDatabase(); await database.initialise();
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes('missing')) throw new Error('Column missing');
      return { schema: { fields: [] }, numRows: 0, getChildAt: () => null };
    });
    await expect(database.query('SELECT missing FROM transactions')).rejects.toThrow('Column missing');
    expect(mocks.query).toHaveBeenLastCalledWith('ROLLBACK');
    await expect(database.query('SELECT id FROM transactions')).resolves.toMatchObject({ rows: [] });
    await expect(database.query('DELETE FROM transactions')).rejects.toThrow('read-only');
    await database.dispose();
  });

  it('terminates a timed-out worker and does not try to close a dead connection', async () => {
    const database = new AcademyDatabase(); await database.initialise();
    vi.useFakeTimers();
    mocks.query.mockReturnValue(new Promise(() => {}));
    const failed = expect(database.query('SELECT id FROM transactions')).rejects.toThrow('15 seconds');
    await vi.advanceTimersByTimeAsync(15000); await failed;
    expect(mocks.workerTerminate).toHaveBeenCalled();
    await database.dispose(); expect(mocks.close).not.toHaveBeenCalled();
    expect(mocks.terminate).toHaveBeenCalled();
  });
  it('releases resources on initialisation failure and reseeds a fresh instance', async () => {
    mocks.instantiate.mockRejectedValueOnce(new Error('Wasm unavailable'));
    const broken = new AcademyDatabase(); await expect(broken.initialise()).rejects.toThrow('Wasm unavailable');
    expect(mocks.terminate).toHaveBeenCalled();
    const fresh = new AcademyDatabase(); await fresh.initialise(); await fresh.dispose();
    const reset = new AcademyDatabase(); await reset.initialise();
    expect(mocks.query.mock.calls.filter(([sql]) => String(sql).startsWith('INSERT INTO transactions'))).toHaveLength(40);
    await reset.dispose();
  });
});

it('seeds a separate cleaning workspace, locks its file access and preserves finance guards', async () => {
  const database = new AcademyDatabase('cleaning'); await database.initialise();
  expect(mocks.registerFileText).toHaveBeenCalledWith('statement.csv', expect.stringContaining('source_row,posted_on,payee,category,amount,reference'));
  const queries = mocks.query.mock.calls.map(([sql]) => String(sql));
  expect(queries.some(sql => sql.startsWith('INSERT INTO transactions'))).toBe(false);
  expect(queries).toContain('LOAD parquet;');
  expect(queries.some(sql => sql.includes('CREATE TABLE raw_statement'))).toBe(true);
  expect(queries.some(sql => sql.includes("allowed_paths = ['statement.csv', 'statement.parquet']"))).toBe(true);
  mocks.query.mockClear();
  await database.query("SELECT * FROM read_csv('statement.csv', all_varchar = true);");
  expect(mocks.query.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN TRANSACTION', "SELECT * FROM read_csv('statement.csv', all_varchar = true);", 'ROLLBACK']);
  await expect(database.query("SELECT * FROM read_csv('private.csv');")).rejects.toThrow();
  mocks.copyFileToBuffer.mockResolvedValue(new Uint8Array([80, 65, 82, 49]));
  expect(await database.downloadFile('statement.parquet')).toEqual(new Uint8Array([80, 65, 82, 49]));
  await database.dispose();
  const finance = new AcademyDatabase(); await finance.initialise();
  await expect(finance.query("SELECT * FROM read_csv('statement.csv');")).rejects.toThrow();
  await expect(finance.downloadFile('statement.parquet')).rejects.toThrow();
  await finance.dispose();
});

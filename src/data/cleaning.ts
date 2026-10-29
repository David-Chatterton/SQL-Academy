export type Workspace = 'finance' | 'cleaning';
export const cleaningFiles = { csv: 'statement.csv', parquet: 'statement.parquet' } as const;
export interface StatementRow { sourceRow: number; postedOn: string; payee: string; category: string; amount: string; reference: string }
// Fixed text inputs preserve the original errors. Amounts are strings, never floats.
export const statementRows: StatementRow[] = [
  { sourceRow: 1, postedOn: '02/01/2025', payee: ' fresh MARKET ', category: 'groceries', amount: '-30.01', reference: 'TX-001' },
  { sourceRow: 2, postedOn: '02/01/2025', payee: 'FRESH MARKET', category: ' Groceries ', amount: '-30.01', reference: 'TX-001' },
  { sourceRow: 3, postedOn: '03/01/2025', payee: ' City Transport ', category: 'transport', amount: '-5.50', reference: 'TX-002' },
  { sourceRow: 4, postedOn: '04/01/2025', payee: 'Stream & Sound', category: '   ', amount: '-15.99', reference: 'TX-003' },
  { sourceRow: 5, postedOn: '05/01/2025', payee: ' Retail Refund ', category: 'REFUNDS', amount: '12.50', reference: 'TX-004' },
  { sourceRow: 6, postedOn: '31/02/2025', payee: 'Fresh Market', category: 'groceries', amount: '-9.99', reference: 'TX-005' },
  { sourceRow: 7, postedOn: '06/01/2025', payee: 'Picture House', category: 'entertainment', amount: 'unknown', reference: 'TX-006' },
  { sourceRow: 8, postedOn: '07/01/2025', payee: '   ', category: 'shopping', amount: '-49.99', reference: 'TX-007' },
  { sourceRow: 9, postedOn: '08/01/2025', payee: 'Own Account Transfer', category: 'transfers', amount: '-100.00', reference: 'TX-008' },
  { sourceRow: 10, postedOn: '09/01/2025', payee: 'Fresh Market', category: 'groceries', amount: '-30.01', reference: 'TX-009' },
  { sourceRow: 11, postedOn: '', payee: 'Green Energy', category: 'utilities', amount: '-80.00', reference: 'TX-010' },
  { sourceRow: 12, postedOn: '10/01/2025', payee: ' Account service fee ', category: 'fees', amount: '', reference: 'TX-011' },
];
const csvCell = (value: string) => `"${value.replaceAll('"', '""')}"`;
export function statementCSV(): string {
  return 'source_row,posted_on,payee,category,amount,reference\n' + statementRows.map(row =>
    [String(row.sourceRow), row.postedOn, row.payee, row.category, row.amount, row.reference].map(csvCell).join(','),
  ).join('\n') + '\n';
}
export const rawStatementSQL = "CREATE TABLE raw_statement AS SELECT * FROM read_csv('statement.csv', header = true, all_varchar = true);";
export const cleanCandidatesSQL = `CREATE VIEW clean_candidates AS
SELECT CAST(source_row AS INTEGER) AS source_row,
       CAST(TRY_STRPTIME(posted_on, '%d/%m/%Y') AS DATE) AS posted_date,
       NULLIF(UPPER(TRIM(payee)), '') AS payee_name,
       COALESCE(NULLIF(UPPER(TRIM(category)), ''), 'UNCATEGORISED') AS category_name,
       TRY_CAST(TRIM(amount) AS DECIMAL(12,2)) AS amount,
       TRIM(reference) AS reference
FROM raw_statement;`;
export const parquetFixtureSQL = `COPY (
  SELECT CAST(source_row AS INTEGER) AS source_row,
         CAST(TRY_STRPTIME(posted_on, '%d/%m/%Y') AS DATE) AS posted_date,
         payee, TRY_CAST(amount AS DECIMAL(12,2)) AS amount, reference
  FROM raw_statement WHERE source_row IN ('1', '3', '5')
  ORDER BY CAST(source_row AS INTEGER)
) TO 'statement.parquet' (FORMAT PARQUET);`;
export const cleaningSecuritySQL = "SET memory_limit = '128MB'; SET allowed_paths = ['statement.csv', 'statement.parquet']; SET enable_external_access = false; SET lock_configuration = true;";
export function cleaningNativeSetup(): string {
  return `-- Put statement.csv beside this script. Run in a fresh practice database.\nBEGIN TRANSACTION;\n${rawStatementSQL}\n${cleanCandidatesSQL}\n${parquetFixtureSQL}\nCOMMIT;\n`;
}

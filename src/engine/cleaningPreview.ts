import { statementRows } from '../data/cleaning';
export function parseStatementDate(text: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const date = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  return date.getUTCFullYear() === Number(yyyy) && date.getUTCMonth() === Number(mm) - 1 && date.getUTCDate() === Number(dd) ? `${yyyy}-${mm}-${dd}` : null;
}
export function parseStatementPence(text: string): number | null {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(text.trim());
  if (!match) return null;
  return (match[1] ? -1 : 1) * (Number(match[2]) * 100 + Number((match[3] ?? '').padEnd(2, '0')));
}
export function normalisedStatement() {
  return statementRows.map(row => {
    const postedDate = parseStatementDate(row.postedOn), pence = parseStatementPence(row.amount);
    const payeeName = row.payee.trim().toUpperCase() || null;
    return { sourceRow: row.sourceRow, postedDate, payeeName, categoryName: row.category.trim().toUpperCase() || 'UNCATEGORISED', pence, reference: row.reference.trim(),
      reason: !postedDate ? 'invalid_or_missing_date' : pence === null ? 'invalid_or_missing_amount' : !payeeName ? 'missing_payee' : null };
  });
}
export function distinctStatement() {
  const seen = new Set<string>();
  return normalisedStatement().filter(row => {
    if (row.reason) return false;
    const key = JSON.stringify([row.postedDate, row.payeeName, row.categoryName, row.pence, row.reference]);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

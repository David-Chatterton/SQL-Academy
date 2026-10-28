export interface Token { text: string; kind: 'word' | 'identifier' | 'literal' | 'symbol' }
// A small lexer, not a substitute SQL parser. DuckDB remains responsible for syntax.
// It removes comments and keeps literals separate so words inside them cannot count as techniques.
export function tokens(sql: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < sql.length) {
    if (/\s/.test(sql[i])) { i++; continue; }
    if (sql.slice(i, i + 2) === '--') { while (i < sql.length && sql[i] !== '\n') i++; continue; }
    if (sql.slice(i, i + 2) === '/*') {
      i += 2; let depth = 1;
      while (i < sql.length && depth) {
        if (sql.slice(i, i + 2) === '/*') { depth++; i += 2; }
        else if (sql.slice(i, i + 2) === '*/') { depth--; i += 2; }
        else i++;
      }
      if (depth) throw new Error('Close the SQL comment with */.');
      continue;
    }
    if (sql[i] === "'" || sql[i] === '"') {
      const quote = sql[i++]; let value = ''; let closed = false;
      while (i < sql.length) {
        if (sql[i] === quote) {
          if (sql[i + 1] === quote) { value += quote; i += 2; }
          else { i++; closed = true; break; }
        } else value += sql[i++];
      }
      if (!closed) throw new Error('Close the quoted text before running the query.');
      out.push({ text: quote === '"' ? value.toUpperCase() : value, kind: quote === '"' ? 'identifier' : 'literal' });
      continue;
    }
    const word = /^[A-Za-z_][A-Za-z_0-9]*/.exec(sql.slice(i));
    if (word) { out.push({ text: word[0].toUpperCase(), kind: 'word' }); i += word[0].length; continue; }
    const number = /^\d+(?:\.\d+)?/.exec(sql.slice(i));
    if (number) { out.push({ text: number[0], kind: 'literal' }); i += number[0].length; continue; }
    out.push({ text: sql[i++], kind: 'symbol' });
  }
  return out;
}
const forbidden = new Set('INSERT UPDATE DELETE CREATE DROP ALTER TRUNCATE COPY EXPORT IMPORT ATTACH DETACH INSTALL LOAD PRAGMA CALL SET RESET VACUUM CHECKPOINT BEGIN COMMIT ROLLBACK REPLACE MERGE GRANT REVOKE INTO'.split(' '));
const safeFunctions = new Set('ABS ROUND LOWER UPPER TRIM LENGTH COALESCE NULLIF CAST TRY_CAST COUNT SUM AVG MIN MAX'.split(' '));
const groupingWords = new Set('SELECT WHERE AND OR NOT IN AS ON WHEN THEN ELSE FROM HAVING DISTINCT'.split(' '));
export function assertReadOnly(sql: string): Token[] {
  if (sql.length > 20000) throw new Error('Keep Academy queries under 20,000 characters.');
  const list = tokens(sql);
  if (list.at(-1)?.text === ';' && list.at(-1)?.kind === 'symbol') list.pop();
  if (!list.length || list[0].text !== 'SELECT') throw new Error('This workspace is read-only. Start with SELECT to explore the training tables.');
  if (list.some(t => t.text === ';' && t.kind === 'symbol')) throw new Error('Run one SELECT statement at a time.');
  for (let i = 0; i < list.length; i++) {
    const token = list[i];
    if (token.kind === 'symbol' && !'(),.*+-/%<>=!'.includes(token.text)) throw new Error('This syntax is outside the academy read-only workspace.');
    if (token.kind !== 'word' && token.kind !== 'identifier') continue;
    if (forbidden.has(token.text)) throw new Error(`${token.text} is disabled here to protect the training data. Use SELECT instead.`);
    if (list[i + 1]?.text === '(' && !safeFunctions.has(token.text) && !groupingWords.has(token.text)) {
      throw new Error(`The function ${token.text} is outside the academy read-only workspace.`);
    }
  }
  return list;
}
export function hasTechnique(list: Token[], technique: string): boolean {
  const parts = technique.split(' ');
  // LEFT OUTER JOIN and LEFT JOIN express the same taught operation.
  const canonical = list.filter((token, index) => !(token.kind === 'word' && token.text === 'OUTER'
    && list[index - 1]?.kind === 'word' && ['LEFT', 'RIGHT', 'FULL'].includes(list[index - 1].text)
    && list[index + 1]?.kind === 'word' && list[index + 1].text === 'JOIN'));
  return canonical.some((_, i) => parts.every((part, j) => canonical[i + j]?.kind === 'word' && canonical[i + j].text === part));
}

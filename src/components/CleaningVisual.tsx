import { useState } from 'react';
import { statementRows } from '../data/cleaning';
import { money } from '../data/finance';
import { distinctStatement, normalisedStatement } from '../engine/cleaningPreview';
const normalised = normalisedStatement(), distinct = distinctStatement();
const stages = {
  raw: { label: '1. Raw import', sql: 'SELECT * FROM raw_statement ORDER BY CAST(source_row AS INTEGER);' },
  standard: { label: '2. Parsed and standardised', sql: 'SELECT * FROM clean_candidates ORDER BY source_row;' },
  rejected: { label: '3. Rejected for review', sql: 'SELECT * FROM clean_candidates WHERE posted_date IS NULL OR amount IS NULL OR payee_name IS NULL ORDER BY source_row;' },
  eligible: { label: '4. Eligible source rows', sql: 'SELECT * FROM clean_candidates WHERE posted_date IS NOT NULL AND amount IS NOT NULL AND payee_name IS NOT NULL ORDER BY source_row;' },
  distinct: { label: '5. Distinct business records', sql: 'SELECT DISTINCT posted_date, payee_name, category_name, amount, reference FROM clean_candidates WHERE posted_date IS NOT NULL AND amount IS NOT NULL AND payee_name IS NOT NULL ORDER BY posted_date, reference;' },
};
type Stage = keyof typeof stages;
export function CleaningVisual({ onRun, disabled }: { onRun(sql: string): void; disabled: boolean }) {
  const [stage, setStage] = useState<Stage>('raw');
  const [revealed, setRevealed] = useState(false);
  const rows = stage === 'distinct' ? distinct : normalised.filter(row => stage === 'eligible' ? !row.reason : stage === 'rejected' ? row.reason : true);
  return <div className="visual-lesson">
    <span className="eyebrow">VISUAL EXPLANATION</span><h3>Follow the statement from raw rows to usable records</h3>
    <p>This preview calculates the cleaning stages from the actual 12-row fixture. The stage counts reconcile the original rows; SQL execution and lesson completion use DuckDB, not this preview.</p>
    <label>Cleaning stage <select aria-label="Cleaning stage" value={stage} onChange={event => { setStage(event.target.value as Stage); setRevealed(false); }}>{Object.entries(stages).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select></label>
    <div className="visual-flow"><span>12 imported</span><span aria-hidden="true">→</span><span>5 rejected · 7 eligible</span><span aria-hidden="true">→</span><strong>6 distinct transactions</strong></div>
    <p role="status">{rows.length} rows in this stage.</p>
    <div className="grid-scroll" tabIndex={0} role="region" aria-label="Cleaning stage preview"><table><caption>{stages[stage].label}</caption><thead><tr>{stage !== 'distinct' && <th>Source row</th>}<th>{stage === 'raw' ? 'Date text' : 'Parsed date'}</th><th>Payee</th><th>Category</th><th>Amount</th><th>Reference</th>{stage !== 'raw' && stage !== 'distinct' && <th>Review reason</th>}</tr></thead><tbody>{rows.map(row => {
      const raw = statementRows.find(item => item.sourceRow === row.sourceRow)!;
      return <tr key={row.sourceRow} className={stage !== 'raw' && row.reason ? 'unmatched-row' : ''}>{stage !== 'distinct' && <td>{row.sourceRow}</td>}<td>{stage === 'raw' ? raw.postedOn || 'NULL' : row.postedDate ?? 'NULL'}</td><td>{stage === 'raw' ? JSON.stringify(raw.payee) : row.payeeName ?? 'NULL'}</td><td>{stage === 'raw' ? JSON.stringify(raw.category) : row.categoryName}</td><td>{stage === 'raw' ? raw.amount || 'NULL' : row.pence === null ? 'NULL' : money(row.pence)}</td><td>{row.reference}</td>{stage !== 'raw' && stage !== 'distinct' && <td>{row.reason ?? 'Eligible'}</td>}</tr>;
    })}</tbody></table></div>
    <p>TX-001 occurs twice before deduplication. TX-009 is a separate purchase with the same amount and payee, so its reference keeps it distinct. Source row numbers identify evidence and are excluded from the duplicate comparison.</p>
    <button aria-expanded={revealed} aria-controls="cleaning-preview-sql" onClick={() => setRevealed(value => !value)}>{revealed ? 'Hide visual SQL' : 'Reveal visual SQL'}</button>
    <div id="cleaning-preview-sql" hidden={!revealed}>{revealed && <><pre className="sql-block"><code>{stages[stage].sql}</code></pre><button className="primary" disabled={disabled} onClick={() => onRun(stages[stage].sql)}>Run this cleaning stage in DuckDB</button></>}</div>
  </div>;
}

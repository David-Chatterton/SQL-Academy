import { useState } from 'react';
import { generateTransactions, money } from '../data/finance';
import type { Lesson } from '../types';
// Preview calculations use integer pence from the exact same deterministic seed.
const sample = generateTransactions().filter(row => row.date === '2024-01-02' && row.category === 'Groceries').slice(0, 6);
export function AggregateVisual({ lesson, onRun, disabled }: { lesson: Lesson; onRun(sql: string): void; disabled: boolean }) {
  const [minimum, setMinimum] = useState(0);
  const [grouped, setGrouped] = useState(false);
  const [threshold, setThreshold] = useState(0);
  const [sqlVisible, setSqlVisible] = useState(false);
  const rows = sample.filter(row => -row.pence >= minimum * 100);
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = grouped ? row.date : 'All selected rows';
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  // An ungrouped aggregate still returns a row when WHERE removes every input.
  if (!grouped && !rows.length) groups.set('All selected rows', []);
  const summaries = [...groups].map(([key, items]) => ({ key, count: items.length, total: -items.reduce((sum, row) => sum + row.pence, 0) }))
    .filter(row => row.count > 0 ? row.total > threshold * 100 : false);
  const sql = `SELECT ${grouped ? 'date, ' : ''}COUNT(*) AS purchase_count,\n       -SUM(amount) AS total_spending\nFROM transactions\nWHERE category = 'Groceries' AND amount < 0\n  AND -amount >= ${minimum}${grouped ? '\nGROUP BY date' : ''}\nHAVING -SUM(amount) > ${threshold}${grouped ? '\nORDER BY date' : ''};`;
  return <div className="visual-lesson">
    <div className="section-heading"><span className="eyebrow">VISUAL EXPLANATION</span><h3>From purchase rows to a summary</h3></div>
    <p>Practise the row → group → total pipeline for “{lesson.title}”. This preview uses six controlled grocery purchases from 2 January 2024, including the £30, £50 and £100 boundaries. It is a small teaching sample, not the full task result.</p>
    <label className="range-control">Minimum individual purchase: £{minimum}<input aria-label="Minimum individual purchase" type="range" min="0" max="110" value={minimum} onChange={e => setMinimum(Number(e.target.value))}/><span>WHERE: retain purchases at least this size.</span></label>
    <label className="inline-check"><input type="checkbox" checked={grouped} onChange={e => setGrouped(e.target.checked)}/>Group by date (this sample contains one date)</label>
    <label className="range-control">Minimum group total, strictly above: £{threshold}<input aria-label="Minimum group total" type="range" min="0" max="400" value={threshold} onChange={e => setThreshold(Number(e.target.value))}/><span>HAVING: test each total after adding the selected rows.</span></label>
    <div className="visual-flow"><span>{sample.length} input rows</span><span aria-hidden="true">→</span><strong>{rows.length} after WHERE</strong><span aria-hidden="true">→</span><span>{summaries.length} after aggregation and HAVING</span></div>
    <div className="grid-scroll"><table><caption>Sample input: retained rows are highlighted</caption><thead><tr><th>Date</th><th>Category</th><th>Amount</th><th>Positive purchase size</th></tr></thead><tbody>{sample.map(row => <tr key={row.id} className={rows.includes(row) ? 'match-row' : 'unmatched-row'}><td>{row.date}</td><td>{row.category}</td><td>{money(row.pence)}</td><td>{money(-row.pence)}</td></tr>)}</tbody></table></div>
    <div className="grid-scroll"><table><caption>Calculated sample summary</caption><thead><tr><th>Group</th><th>purchase_count</th><th>total_spending</th></tr></thead><tbody>{summaries.map(row => <tr key={row.key}><td>{row.key}</td><td>{row.count}</td><td>{money(row.total)}</td></tr>)}</tbody></table></div>
    {!summaries.length && <p>No sample groups pass HAVING. An empty SUM is NULL, which does not pass the total comparison.</p>}
    <p>COUNT counts retained rows. SUM adds their amounts. AVG divides the sum by the number of known inputs; MIN and MAX choose extremes. CASE can choose a different contribution for each row before SUM adds it.</p>
    <button aria-expanded={sqlVisible} aria-controls="aggregate-preview-sql" onClick={() => setSqlVisible(value => !value)}>{sqlVisible ? 'Hide visual SQL' : 'Reveal visual SQL'}</button>
    <div id="aggregate-preview-sql" hidden={!sqlVisible}>{sqlVisible && <><pre className="sql-block">{sql}</pre><button className="primary" disabled={disabled} onClick={() => onRun(sql)}>Run visual query on all 10,000 rows</button><p className="muted">This query applies these controls to the full dataset. It illustrates aggregation; it may not answer your lesson’s task.</p></>}</div>
  </div>;
}

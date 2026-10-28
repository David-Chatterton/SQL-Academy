import { useState } from 'react';
import { generateTransactions, money } from '../data/finance';
import { foreignKey, joinRelationships, previewJoin, type JoinRelationship } from '../engine/joinPreview';
import type { Lesson } from '../types';
const all = generateTransactions();
const sample = [all[0], all.find(row => row.transferId !== null)!,
  all.find(row => row.date === '2024-01-02' && row.category === 'Groceries')!,
  all.find(row => row.categoryId === null)!, all.find(row => row.payee !== row.payee.trim())!];
export function JoinVisual({ lesson, onRun, disabled }: { lesson: Lesson; onRun(sql: string): void; disabled: boolean }) {
  const [relationship, setRelationship] = useState<JoinRelationship>(['m3-1', 'm3-2', 'm3-7'].includes(lesson.id) ? 'account' : lesson.id === 'm3-3' ? 'payee' : 'category');
  const [kind, setKind] = useState<'INNER' | 'LEFT'>(['m3-2', 'm3-3'].includes(lesson.id) ? 'INNER' : 'LEFT');
  const [direction, setDirection] = useState<'transactions' | 'lookup'>(['m3-1', 'm3-6', 'm3-7'].includes(lesson.id) ? 'lookup' : 'transactions');
  const [outflowsOnly, setOutflowsOnly] = useState(false);
  const [placement, setPlacement] = useState<'ON' | 'WHERE'>('ON');
  const [revealed, setRevealed] = useState(false);
  const target = joinRelationships[relationship];
  const rows = previewJoin(sample, { relationship, kind, direction, outflowsOnly, placement });
  const matching = rows.filter(row => row.transactionId !== null && row.lookupId !== null).length;
  const source = direction === 'transactions' ? `transactions AS t\n${kind} JOIN ${target.table} AS l` : `${target.table} AS l\n${kind} JOIN transactions AS t`;
  const sql = `SELECT t.id AS transaction_id, t.${target.column},\n       l.id AS lookup_id, l.name AS lookup_name, t.amount\nFROM ${source}\n  ON t.${target.column} = l.id${outflowsOnly && placement === 'ON' ? '\n  AND t.amount < 0' : ''}${outflowsOnly && placement === 'WHERE' ? '\nWHERE t.amount < 0' : ''}\nORDER BY l.id ASC NULLS LAST, t.id ASC NULLS LAST;`;
  return <div className="visual-lesson">
    <span className="eyebrow">VISUAL EXPLANATION</span><h3>Follow the keys and see which rows survive</h3>
    <p>This teaching sample uses five actual seeded transactions: a salary, a transfer, a grocery boundary, a missing category and a payee-text variant. Lookup records come from the same seed. These are sample results, not your task answer.</p>
    <div className="column-controls">
      <label>Lookup table <select aria-label="Join lookup table" value={relationship} onChange={event => setRelationship(event.target.value as JoinRelationship)}>{Object.entries(joinRelationships).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select></label>
      <label>Join type <select aria-label="Join type" value={kind} onChange={event => setKind(event.target.value as typeof kind)}><option value="INNER">INNER JOIN — matched pairs</option><option value="LEFT">LEFT JOIN — preserve left rows</option></select></label>
      <label>Left-hand source <select aria-label="Left-hand source" value={direction} onChange={event => setDirection(event.target.value as typeof direction)}><option value="transactions">Transactions</option><option value="lookup">Lookup table</option></select></label>
    </div>
    <label className="inline-check"><input type="checkbox" checked={outflowsOnly} onChange={event => setOutflowsOnly(event.target.checked)}/>Match only negative transactions</label>
    {outflowsOnly && <label>Put the amount condition in <select aria-label="Amount filter placement" value={placement} onChange={event => setPlacement(event.target.value as typeof placement)}><option value="ON">ON — restrict matches</option><option value="WHERE">WHERE — filter joined rows</option></select></label>}
    <div className="visual-flow"><span>{direction === 'transactions' ? `${sample.length} transactions` : `${target.lookup.length} lookup rows`}</span><span aria-hidden="true">→</span><strong>{kind} JOIN</strong><span aria-hidden="true">→</span><span aria-live="polite">{rows.length} sample result rows · {matching} matched pairs</span></div>
    <p>Match <code>t.{target.column} = l.id</code>. Lookup IDs are unique. With transactions on the left, each transaction has at most one lookup match; with the lookup on the left, one parent can match several transactions.</p>
    <div className="grid-scroll" tabIndex={0} role="region" aria-label="Sample transaction keys"><table><caption>Transaction sample before the join</caption><thead><tr><th>t.id</th><th>t.{target.column}</th><th>Raw payee text</th><th>Amount</th></tr></thead><tbody>{sample.map(row => <tr key={row.id}><td>{row.id}</td><td>{foreignKey(row, relationship) ?? 'NULL'}</td><td>{row.payee}</td><td>{money(row.pence)}</td></tr>)}</tbody></table></div>
    <div className="grid-scroll" tabIndex={0} role="region" aria-label="Sample lookup keys"><table><caption>{target.table}: unique parent keys</caption><thead><tr><th>l.id</th><th>l.name</th></tr></thead><tbody>{target.lookup.map(row => <tr key={row.id}><td>{row.id}</td><td>{row.name}</td></tr>)}</tbody></table></div>
    <div className="grid-scroll" tabIndex={0} role="region" aria-label="Sample join result"><table><caption>Calculated sample join result</caption><thead><tr><th>transaction_id</th><th>{target.column}</th><th>lookup_id</th><th>lookup_name</th><th>amount</th></tr></thead><tbody>{rows.map((row, index) => <tr key={index} className={row.transactionId !== null && row.lookupId !== null ? 'match-row' : 'unmatched-row'}><td>{row.transactionId ?? 'NULL'}</td><td>{row.foreignKey ?? 'NULL'}</td><td>{row.lookupId ?? 'NULL'}</td><td>{row.lookupName ?? 'NULL'}</td><td>{row.pence === null ? 'NULL' : money(row.pence)}</td></tr>)}</tbody></table></div>
    {!rows.length && <p>No sample rows match these controls.</p>}
    <p>A LEFT JOIN inserts NULLs on the unmatched side. Moving a right-side restriction from ON to WHERE can remove these preserved rows. Count a matched transaction ID rather than COUNT(*) when reporting zero activity.</p>
    <button aria-expanded={revealed} aria-controls="join-preview-sql" onClick={() => setRevealed(value => !value)}>{revealed ? 'Hide visual SQL' : 'Reveal visual SQL'}</button>
    <div id="join-preview-sql" hidden={!revealed}>{revealed && <><pre className="sql-block"><code>{sql}</code></pre><button className="primary" disabled={disabled} onClick={() => onRun(sql)}>Run visual join on the full dataset</button><p className="muted">This runs the selected join against every seeded record in DuckDB. The full result differs from the five-row preview and may not answer this lesson’s task.</p></>}</div>
  </div>;
}

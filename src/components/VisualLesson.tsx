import { useState } from 'react';
import { AggregateVisual } from './AggregateVisual';
import { JoinVisual } from './JoinVisual';
import { CleaningVisual } from './CleaningVisual';
import { generateTransactions, money, type Transaction } from '../data/finance';
import type { Lesson } from '../types';
const all = generateTransactions();
const sample = [all[0], all.find(row => row.transferId !== null)!,
  ...all.filter(row => row.date === '2024-01-02' && row.category === 'Groceries').slice(0, 6),
  ...all.filter(row => row.pence < -100000 && row.category !== 'Housing'), ...all.slice(250, 255)];
const fields = ['id', 'date', 'payee', 'category', 'amount'] as const;
type Field = typeof fields[number];
const get = (row: Transaction, field: Field) => field === 'amount' ? money(row.pence) : String(row[field] ?? 'NULL');
export function VisualLesson({ lesson, onRun, disabled }: { lesson: Lesson; onRun(sql: string): void; disabled: boolean }) {
  const [selected, setSelected] = useState<Field[]>(['date', 'payee', 'amount']);
  const [threshold, setThreshold] = useState(30);
  const [ascending, setAscending] = useState(true);
  const [showMatches, setShowMatches] = useState(false);
  if (lesson.visual === 'cleaning') return <CleaningVisual onRun={onRun} disabled={disabled}/>;
  if (lesson.visual === 'join') return <JoinVisual lesson={lesson} onRun={onRun} disabled={disabled}/>;
  if (lesson.visual === 'aggregate') return <AggregateVisual lesson={lesson} onRun={onRun} disabled={disabled}/>;
  const kind = lesson.visual;
  const isProjection = kind === 'projection', isSort = kind === 'sort', isDistinct = kind === 'distinct';
  const filtering = ['filter', 'range', 'logic', 'investigate'].includes(kind);
  const match = (row: Transaction) => {
    if (kind === 'filter') return row.category === 'Groceries' && row.pence < -threshold * 100;
    if (kind === 'range') return row.pence >= -10000 && row.pence <= -5000;
    if (kind === 'logic') return (row.category === 'Groceries' && row.pence < -threshold * 100) || (row.category === 'Restaurants' && row.pence < -5000);
    if (kind === 'investigate') return row.pence < -100000 && row.category !== null && !['Housing', 'Transfers'].includes(row.category);
    if (isSort) return row.pence < 0 && row.category !== null && row.category !== 'Transfers';
    return true;
  };
  let shown = sample.filter(row => !showMatches || match(row));
  if (isSort) shown = shown.filter(match).sort((a, b) => (ascending ? a.pence - b.pence : b.pence - a.pence) || a.id - b.id).slice(0, 10);
  const columns: readonly Field[] = isDistinct ? ['category'] : fields;
  if (isDistinct) shown = shown.filter((row, index, arr) => arr.findIndex(r => r.category === row.category) === index);
  const sql = isProjection ? `SELECT ${selected.join(', ') || '*'}\nFROM transactions;`
    : kind === 'filter' ? `SELECT date, payee, category, amount\nFROM transactions\nWHERE category = 'Groceries' AND amount < -${threshold};`
    : kind === 'logic' ? `SELECT date, payee, category, amount\nFROM transactions\nWHERE (category = 'Groceries' AND amount < -${threshold})\n   OR (category = 'Restaurants' AND amount < -50);`
    : isSort ? `SELECT id, date, payee, amount\nFROM transactions\nWHERE amount < 0 AND category <> 'Transfers'\nORDER BY amount ${ascending ? 'ASC' : 'DESC'}, id ASC\nLIMIT 10;` : lesson.solution;
  return <div className="visual-lesson">
    <div className="section-heading"><span className="eyebrow">VISUAL EXPLANATION</span><h3>{isProjection ? 'Keep the columns you need' : isSort ? 'See the order change' : isDistinct ? 'From repeated values to a unique list' : filtering ? 'Which rows answer the question?' : 'One row. One transaction.'}</h3></div>
    <p className="muted">This teaching view uses {sample.length} selected records from the seeded dataset. It illustrates query meaning, not DuckDB’s physical execution.</p>
    {isProjection && <fieldset className="column-controls"><legend>Choose columns</legend>{fields.map(field => <label key={field}><input type="checkbox" checked={selected.includes(field)} onChange={e => setSelected(s => e.target.checked ? fields.filter(f => f === field || s.includes(f)) : s.filter(f => f !== field))}/>{field}</label>)}</fieldset>}
    {(kind === 'filter' || kind === 'logic') && <label className="range-control">Grocery purchase threshold: £{threshold}<input aria-label="Grocery purchase threshold" type="range" min="0" max="150" value={threshold} onChange={e => setThreshold(Number(e.target.value))}/><span>Strictly greater than this purchase size</span></label>}
    {isSort && <label>Amount order <select aria-label="Amount order" value={ascending ? 'ASC' : 'DESC'} onChange={e => setAscending(e.target.value === 'ASC')}><option value="ASC">Ascending — largest purchases first</option><option value="DESC">Descending — smallest purchases first</option></select></label>}
    {filtering && <label className="inline-check"><input type="checkbox" checked={showMatches} onChange={e => setShowMatches(e.target.checked)}/>Show only matching sample rows</label>}
    <div className="visual-flow"><span>transactions</span><span aria-hidden="true">→</span><strong>{isProjection ? 'SELECT columns' : isSort ? 'ORDER BY → LIMIT' : isDistinct ? 'DISTINCT category' : filtering ? 'WHERE condition' : 'SELECT *'}</strong><span aria-hidden="true">→</span><span>result</span></div>
    <div className="grid-scroll" tabIndex={0} role="region" aria-label="Scrollable visual teaching sample"><table><thead><tr>{columns.map(field => <th key={field} className={isProjection && !selected.includes(field) ? 'excluded-column' : ''}>{field}</th>)}</tr></thead><tbody>{shown.map(row => <tr key={row.id} className={filtering ? match(row) ? 'match-row' : 'unmatched-row' : ''}>{columns.map(field => <td key={field} className={`${isProjection && !selected.includes(field) ? 'excluded-column' : ''} ${field === 'amount' ? 'numeric' : ''}`}>{get(row, field)}</td>)}</tr>)}</tbody></table></div>
    {filtering && <p className="legend"><span className="match-dot"/>Highlighted rows match; faded rows are removed by WHERE.</p>}
    {isDistinct && <p>Unique values in this sample are only a subset. Run the query below to see every category in the full database.</p>}
    {isProjection && <p>{selected.length} of {fields.length} preview columns retained. The complete transactions table has 11 columns.</p>}
    <pre className="sql-block">{sql}</pre><button className="primary" disabled={disabled || (isProjection && !selected.length)} onClick={() => onRun(sql)}>Run visual query on all 10,000 rows</button>
    <p className="muted">The actual database result appears below. You can edit the generated SQL in the SQL tab.</p>
  </div>;
}

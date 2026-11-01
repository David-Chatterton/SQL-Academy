import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { generateTransactions } from '../data/finance';
import { lessons, modules, plannedModules } from '../content/lessons';
import { recommendedLesson } from '../hooks/progress';
import type { Progress } from '../types';
const monthly = Array.from({ length: 24 }, (_, i) => ({ month: `${2024 + Math.floor(i / 12)}-${String(i % 12 + 1).padStart(2, '0')}`, pence: 0 }));
for (const row of generateTransactions()) {
  if (row.pence < 0 && row.category !== 'Transfers') {
    const month = monthly.find(m => m.month === row.date.slice(0, 7));
    if (month) month.pence -= row.pence;
  }
}
const chartData = monthly.map(m => ({ month: m.month, spending: m.pence / 100 }));
export function Dashboard({ progress, onSelect }: { progress: Progress; onSelect(id: string): void }) {
  const complete = Object.keys(progress.completed).length;
  const mastered = [...new Set(lessons.filter(l => progress.completed[l.id]).flatMap(l => l.concepts))];
  return <div className="dashboard">
    <span className="eyebrow">YOUR LEARNING DASHBOARD</span><h1>From spreadsheets to SQL.</h1><p className="lead">Learn practical SQL with DuckDB.</p><p>An independent SQL learning project using DuckDB, with fictional financial data.</p>
    <div className="stats"><div><strong>{complete}<small> / {lessons.length}</small></strong><span>Lessons completed</span></div><div><strong>{Math.round(complete / lessons.length * 100)}%</strong><span>Course progress</span></div><div><strong>10,000</strong><span>Fictional transactions</span></div></div>
    <section className="dashboard-card"><div className="card-heading"><div><span className="eyebrow">NEXT STEP</span><h2>{complete === lessons.length ? 'Revisit your SQL skills' : lessons.find(l => l.id === recommendedLesson(progress))?.title}</h2></div><button className="primary" onClick={() => onSelect(recommendedLesson(progress))}>{complete === lessons.length ? 'Review lessons' : 'Continue learning'} →</button></div><p>Run queries, inspect results and solve each task. Progress is saved in this browser independently of the database.</p><div className="progress-track"><div style={{ width: `${complete / lessons.length * 100}%` }}/></div></section>
    <section className="dashboard-card"><h2>Concepts practised successfully</h2>{mastered.length ? <div className="concepts">{mastered.map(c => <span key={c}>{c}</span>)}</div> : <p className="muted">Complete a lesson to start building your SQL toolkit.</p>}</section>
    <section className="dashboard-card"><h2>Your fictional financial laboratory</h2><p>Monthly outflows across the seeded dataset, excluding internal transfers. This is a teaching dataset with controlled anomalies and duplicates, not a household budget recommendation. Totals include uncategorised spending.</p><div className="chart" role="img" aria-label="Monthly fictional spending across January 2024 to December 2025"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="month" minTickGap={50}/><YAxis tickFormatter={v => `£${Number(v) / 1000}k`}/><Tooltip formatter={value => `£${Number(value).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`}/><Bar isAnimationActive={false} dataKey="spending" fill="#48bfa5" radius={[4, 4, 0, 0]}/></BarChart></ResponsiveContainer></div><details><summary>View chart data as a table</summary><div className="grid-scroll"><table><thead><tr><th>Month</th><th>Outflows excluding transfers</th></tr></thead><tbody>{chartData.map(row => <tr key={row.month}><td>{row.month}</td><td>£{row.spending.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td></tr>)}</tbody></table></div></details></section>
    <section className="dashboard-card"><h2>Curriculum roadmap</h2><p>Modules {modules.map(module => module.id).join(', ')} are available. Later modules are planned and have no lesson links.</p><div className="roadmap">{modules.map(module => <div key={module.id}><span>{String(module.id).padStart(2, '0')}</span><strong>{module.title}</strong><em>{module.lessons.length} lessons available</em></div>)}{plannedModules.map((module, i) => <div key={module}><span>{String(i + modules.length + 1).padStart(2, '0')}</span><strong>{module}</strong><em>Planned</em></div>)}</div></section>
  </div>;
}

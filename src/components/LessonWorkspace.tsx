import { useRef, useState } from 'react';
import { Play, RotateCcw, Copy, Lightbulb, Eye, CheckCircle2, ArrowRight } from 'lucide-react';
import type { Lesson, QueryResult } from '../types';
import { validateResult } from '../engine/results';
import { SqlEditor } from './SqlEditor';
import { ResultsGrid } from './ResultsGrid';
import { VisualLesson } from './VisualLesson';
import { TerminalLesson } from './TerminalLesson';
import { CleaningFiles } from './CleaningFiles';
import { DBeaverLesson } from './DBeaverLesson';
const lessonViews = ['visual', 'sql', 'terminal', 'dbeaver'] as const;
const viewLabels = { visual: 'Visual', sql: 'SQL editor', terminal: 'Terminal', dbeaver: 'DBeaver' };
interface Props {
  lesson: Lesson; index: number; hasNext: boolean; prerequisiteLabel: string; dark: boolean; ready: boolean; completed: boolean;
  downloadFile(name: 'statement.csv' | 'statement.parquet'): Promise<Uint8Array>;
  query(sql: string): Promise<QueryResult>; complete(): void; retry(): void; next(): void;
}
export function LessonWorkspace({ lesson, index, hasNext, prerequisiteLabel, dark, ready, completed, downloadFile, query, complete, retry, next }: Props) {
  const [tab, setTab] = useState<typeof lessonViews[number]>('sql');
  const [sql, setSql] = useState(lesson.starter);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [hint, setHint] = useState(0), [solution, setSolution] = useState(false);
  const [syntaxVisible, setSyntaxVisible] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const [tabHeight, setTabHeight] = useState(320);
  const running = useRef(false);
  const practicePanel = useRef<HTMLDivElement>(null);
  const selectTab = (view: typeof tab) => { setTab(view); practicePanel.current?.scrollTo({ top: 0 }); };
  const execute = async (text: string): Promise<QueryResult | null> => {
    if (running.current || !ready) return null;
    running.current = true; setBusy(true); setError(''); setFeedback(null); setResult(null);
    try {
      const actual = await query(text); setResult(actual);
      const expected = await query(lesson.solution);
      const validation = validateResult(actual, expected, lesson, text);
      setFeedback(validation); if (validation.ok) complete();
      return actual;
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : String(failure);
      setError(`${message}\nCheck column names, quotes and clause order. FROM comes before WHERE; ORDER BY comes before LIMIT.`);
      return null;
    } finally { running.current = false; setBusy(false); }
  };
  const reset = () => { setSql(lesson.starter); setResult(null); setFeedback(null); setError(''); setHint(0); setSolution(false); setSyntaxVisible(false); };
  const copy = async () => {
    try { await navigator.clipboard.writeText(sql); setCopyStatus('SQL copied.'); } catch { setCopyStatus('Clipboard unavailable. Select and copy the SQL manually.'); }
  };
  return <div className="lesson-workspace">
    <div className="lesson-top"><div><span className="eyebrow">MODULE {String(lesson.module).padStart(2, '0')} / LESSON {String(index + 1).padStart(2, '0')}</span><h1>{lesson.title}</h1></div><span className={`lesson-badge ${completed ? 'done' : ''}`}>{completed ? <><CheckCircle2 size={15}/>Completed</> : 'In progress'}</span></div>
    <div className="workspace-panels">
      <article className="lesson-reading" aria-label="Lesson content" tabIndex={0}>
        {lesson.module === 4 && <CleaningFiles ready={ready} downloadFile={downloadFile}/>}
        <section><span className="eyebrow">LEARNING OBJECTIVES</span><ul className="objectives">{lesson.objectives.map(o => <li key={o}>{o}</li>)}</ul></section>
        <section className="lesson-explanation"><span className="eyebrow">UNDERSTAND</span>{lesson.explanation.map(p => <p key={p}>{p}</p>)}</section>
        <aside className="excel-note"><span className="eyebrow">FROM YOUR EXCEL TOOLKIT</span><p>{lesson.excel}</p></aside>
        <section className="task-card"><span className="eyebrow">YOUR TASK</span><p>{lesson.task}</p><small>{lesson.completionCriteria}</small></section>
        <section><h3>Read the syntax</h3><button aria-expanded={syntaxVisible} aria-controls="lesson-syntax" onClick={() => setSyntaxVisible(visible => !visible)}><Eye size={16}/>{syntaxVisible ? 'Hide the syntax' : 'Reveal the syntax'}</button><div id="lesson-syntax" hidden={!syntaxVisible}>{syntaxVisible && <dl className="syntax-list">{lesson.syntax.map(s => <div key={s.clause}><dt><code>{s.clause}</code></dt><dd>{s.meaning}</dd></div>)}</dl>}</div></section>
        {lesson.prerequisites.length > 0 && <p className="muted">Recommended preparation: {prerequisiteLabel}. You can revisit any lesson at any time.</p>}
        <section className="solution" aria-labelledby="final-help-heading">
          <h3 id="final-help-heading">Final help: the complete answer</h3>
          <p>Need the full query? Reveal the reference solution when you are ready.</p>
          <button aria-expanded={solution} aria-controls="complete-answer" onClick={() => setSolution(visible => !visible)}><Eye size={16}/>{solution ? 'Hide solution' : 'Reveal solution'}</button>
          <div id="complete-answer" hidden={!solution}>{solution && <>
            <pre className="sql-block"><code>{lesson.solution}</code></pre>
            <p>{lesson.solutionWhy}</p>
            <button disabled={busy} onClick={() => { setSql(lesson.solution); selectTab('sql'); document.getElementById('tab-sql')?.focus(); }}>Load solution into editor</button>
            <p className="muted">Revealing or loading a solution does not complete the lesson. Run it to check the actual result.</p>
          </>}</div>
        </section>
      </article>
      <div className="practice-panel" ref={practicePanel} role="region" aria-label="Practice workspace" tabIndex={0}>
        <div className="tabs" role="tablist" aria-label="Lesson view">{lessonViews.map(view => <button key={view} id={`tab-${view}`} role="tab" aria-selected={tab === view} aria-controls={`panel-${view}`} tabIndex={tab === view ? 0 : -1} onKeyDown={e => {
          const views = lessonViews;
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'Home' || e.key === 'End') {
            e.preventDefault(); const target = e.key === 'Home' ? 'visual' : e.key === 'End' ? views[views.length - 1] : views[(views.indexOf(view) + (e.key === 'ArrowRight' ? 1 : views.length - 1)) % views.length];
            selectTab(target); document.getElementById(`tab-${target}`)?.focus();
          }
        }} onClick={() => selectTab(view)}>{viewLabels[view]}</button>)}<span className="read-only">{lesson.module === 4 ? 'Statement practice' : 'Read-only dataset'}</span></div>
        <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
          {tab === 'sql' && <><div className="editor-resizable" style={{ height: tabHeight }}><SqlEditor value={sql} onChange={setSql} onRun={() => void execute(sql)} dark={dark}/></div><label className="resize-control">Editor height<input aria-label="Editor height" type="range" min="200" max="650" step="25" value={tabHeight} onChange={e => setTabHeight(Number(e.target.value))}/></label>
            <div className="query-toolbar"><button className="primary" disabled={busy || !ready} onClick={() => void execute(sql)}><Play size={15}/>{busy ? 'Running…' : 'Run Query'}</button><span className="shortcut">Ctrl / ⌘ + Enter</span><button disabled={busy} onClick={reset}><RotateCcw size={15}/>Reset query</button><button onClick={() => void copy()}><Copy size={15}/>Copy SQL</button></div></>}
          {tab === 'visual' && <VisualLesson lesson={lesson} disabled={busy || !ready} onRun={text => { setSql(text); void execute(text); }}/>} 
          {tab === 'terminal' && <TerminalLesson lesson={lesson} execute={execute} disabled={busy || !ready}/>}
          {tab === 'dbeaver' && <DBeaverLesson lesson={lesson}/>}
        </div>
        <div className="assistance"><button disabled={hint >= lesson.hints.length} onClick={() => setHint(h => h + 1)}><Lightbulb size={16}/>Show hint {Math.min(hint + 1, lesson.hints.length)} / {lesson.hints.length}</button><button disabled={busy} onClick={() => { retry(); reset(); }}>Retry lesson</button></div>
        {hint > 0 && <div className="hints"><strong>Progressive hints</strong><ol>{lesson.hints.slice(0, hint).map(h => <li key={h}>{h}</li>)}</ol></div>}
        {copyStatus && <p role="status" className="muted">{copyStatus}</p>}
        {error && <pre className="error-message" role="alert" aria-label="SQL query error">{error}</pre>}
        {feedback && <div role="status" className={`feedback ${feedback.ok ? 'success' : 'needs-work'}`}>{feedback.ok && <CheckCircle2 size={18}/>}<span>{feedback.message}</span></div>}
        <div className="results-panel"><div className="results-heading"><h3>Query results</h3><span role="status">{busy ? 'Executing in DuckDB…' : result ? 'Query complete' : ready ? 'Ready to run' : 'Database loading'}</span></div><ResultsGrid result={result}/></div>
        {completed && hasNext && <div className="next-lesson"><span>Keep building your SQL skills.</span><button className="primary" onClick={next}>Next lesson<ArrowRight size={16}/></button></div>}
        {completed && !hasNext && <div className="next-lesson"><span>You have completed the final available challenge. Review your dashboard to see overall progress.</span><button className="primary" onClick={next}>View dashboard<ArrowRight size={16}/></button></div>}
      </div>
    </div>
  </div>;
}

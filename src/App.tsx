import { useState } from 'react';
import { Database, BookOpen, LayoutDashboard, Check, Menu, X, GitBranch, Download, RotateCcw, ChevronDown, ChevronRight } from 'lucide-react';
import { lessons, modules, plannedModules } from './content/lessons';
import { useDatabase } from './hooks/useDatabase';
import { useProgress } from './hooks/useProgress';
import { useTheme } from './hooks/useTheme';
import { LessonWorkspace } from './components/LessonWorkspace';
import { Dashboard } from './components/Dashboard';
import { SchemaDiagram } from './components/SchemaDiagram';
import { downloadSeed } from './components/TerminalLesson';
import { CleaningFiles } from './components/CleaningFiles';
export default function App() {
  const learning = useProgress(), theme = useTheme();
  const [view, setView] = useState<'lesson' | 'dashboard' | 'schema'>('lesson');
  const [menu, setMenu] = useState(false), [resetProgress, setResetProgress] = useState(false);
  const index = Math.max(0, lessons.findIndex(l => l.id === learning.progress.current));
  const lesson = lessons[index], count = Object.keys(learning.progress.completed).length;
  const workspace = lesson.module === 4 ? 'cleaning' : 'finance';
  const db = useDatabase(workspace);
  const currentModule = modules.find(module => module.id === lesson.module)!;
  const lessonIndex = currentModule.lessons.findIndex(item => item.id === lesson.id);
  const [expandedModule, setExpandedModule] = useState<number | null>(lesson.module);
  const select = (id: string) => { learning.select(id); setExpandedModule(lessons.find(item => item.id === id)!.module); setView('lesson'); setMenu(false); };
  return <div className="app-shell">
    <a href="#main" className="skip-link">Skip to lesson workspace</a>
    <aside className={`sidebar ${menu ? 'mobile-open' : ''}`} aria-label="Course navigation">
      <div className="brand"><div className="brand-icon"><Database size={23}/></div><div>DuckDB<span>ACADEMY</span></div><button className="mobile-close" aria-label="Close course navigation" onClick={() => setMenu(false)}><X/></button></div>
      <div className="course-intro"><span className="eyebrow">YOUR SQL JOURNEY</span><h2>Learn by querying.</h2><p>Real data. Practical skills.</p></div>
      <button className={`nav-dashboard ${view === 'dashboard' ? 'active' : ''}`} onClick={() => { setView('dashboard'); setMenu(false); }}><LayoutDashboard size={18}/>Learning dashboard</button>
      {modules.map(module => <div key={module.id}>
        <button className="module-header" aria-label={`Module ${module.id}: ${module.title}`} aria-expanded={expandedModule === module.id} aria-controls={`module-${module.id}-lessons`} onClick={() => setExpandedModule(previous => previous === module.id ? null : module.id)}><BookOpen size={16} aria-hidden="true"/><strong>{String(module.id).padStart(2, '0')} · {module.title}</strong><span className="module-progress" aria-hidden="true">{module.lessons.filter(item => learning.progress.completed[item.id]).length}/{module.lessons.length}</span>{expandedModule === module.id ? <ChevronDown size={14} aria-hidden="true"/> : <ChevronRight size={14} aria-hidden="true"/>}</button>
        <nav id={`module-${module.id}-lessons`} aria-label={`Module ${module.id} lessons`} hidden={expandedModule !== module.id}>{module.lessons.map((item, i) => <button key={item.id} className={`lesson-nav ${view === 'lesson' && lesson.id === item.id ? 'active' : ''}`} aria-current={view === 'lesson' && lesson.id === item.id ? 'page' : undefined} onClick={() => select(item.id)}><span className={`lesson-number ${learning.progress.completed[item.id] ? 'complete' : ''}`}>{learning.progress.completed[item.id] ? <Check size={13}/> : String(i + 1).padStart(2, '0')}</span><span>{item.title}</span>{learning.progress.completed[item.id] && <span className="sr-only">Completed</span>}</button>)}</nav>
      </div>)}
      <div className="sidebar-roadmap"><span className="eyebrow">COMING NEXT · PLANNED</span>{plannedModules.map((name, i) => <div key={name}><span>{String(i + modules.length + 1).padStart(2, '0')}</span>{name}</div>)}</div>
      <div className="sidebar-progress"><div><strong>Course progress</strong><span>{Math.round(count / lessons.length * 100)}%</span></div><progress aria-label="Course completion" max={lessons.length} value={count}/><small>{count} of {lessons.length} lessons completed</small></div>
    </aside>
    {menu && <button className="menu-backdrop" aria-label="Close navigation" onClick={() => setMenu(false)}/>}
    <div className="main-shell">
      <header className="app-header"><div><button className="mobile-menu" aria-label="Open course navigation" onClick={() => setMenu(true)}><Menu size={20}/></button><span className="header-title">{currentModule.title} <span>/</span> <strong>{view === 'lesson' ? `Lesson ${lessonIndex + 1}` : view === 'schema' ? 'Database schema' : 'Dashboard'}</strong></span></div><div className="header-actions"><span className={`db-status ${db.status}`} role="status"><i/>{db.status === 'ready' ? 'DuckDB ready' : db.status === 'error' ? 'Database error' : 'Preparing database…'}</span><label className="theme-select"><span className="sr-only">Colour theme</span><select aria-label="Colour theme" value={theme.mode} onChange={e => theme.setMode(e.target.value as typeof theme.mode)}><option value="system">System theme</option><option value="light">Light theme</option><option value="dark">Dark theme</option></select></label></div></header>
      <div className="utility-bar"><span><Database size={14}/>{workspace === 'cleaning' ? 'statement practice · 12 source rows · GBP' : 'academy · 2024–2025 · GBP'}</span><div><button onClick={() => setView(v => v === 'schema' ? 'lesson' : 'schema')}><GitBranch size={15}/>Schema</button>{workspace === 'finance' && <button onClick={downloadSeed}><Download size={15}/>SQL seed</button>}<button disabled={db.status === 'loading'} onClick={db.reset}><RotateCcw size={15}/>Reset database</button></div></div>
      {db.status === 'error' && <div className="database-error" role="alert"><strong>DuckDB could not initialise.</strong><p>{db.error}</p><p>Use a browser with WebAssembly and Web Worker support. Ensure the worker and .wasm assets are served correctly.</p><button onClick={db.reset}>Retry database</button></div>}
      {!learning.persisted && <div className="database-error" role="status">Browser storage is unavailable. Progress works for this session but may not survive a reload.</div>}
      <main id="main" tabIndex={-1}>{view === 'dashboard' ? <Dashboard progress={learning.progress} onSelect={select}/> : view === 'schema' ? workspace === 'cleaning' ? <CleaningFiles ready={db.status === 'ready'} downloadFile={db.downloadFile}/> : <SchemaDiagram dark={theme.dark}/> : <LessonWorkspace key={`${lesson.id}:${db.generation}`} lesson={lesson} downloadFile={db.downloadFile} index={lessonIndex} hasNext={index < lessons.length - 1} prerequisiteLabel={lesson.prerequisites.map(id => { const prerequisite = lessons.find(item => item.id === id)!; return prerequisite.title; }).join(', ')} dark={theme.dark} ready={db.status === 'ready'} query={db.query} completed={Boolean(learning.progress.completed[lesson.id])} complete={() => learning.complete(lesson.id)} retry={() => learning.retry(lesson.id)} next={() => index < lessons.length - 1 ? select(lessons[index + 1].id) : setView('dashboard')}/> }</main>
      <footer><span>DuckDB Academy v0.1 · Fictional data, real SQL.</span>{resetProgress ? <span className="reset-confirm">Reset all {lessons.length} lesson completions? <button onClick={() => { learning.reset(); setExpandedModule(modules[0].id); setResetProgress(false); }}>Reset progress</button><button onClick={() => setResetProgress(false)}>Cancel</button></span> : <button onClick={() => setResetProgress(true)}>Reset learning progress</button>}</footer>
    </div>
  </div>;
}

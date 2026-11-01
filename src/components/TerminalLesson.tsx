import { useState, type FormEvent } from 'react';
import type { Lesson, QueryResult } from '../types';
import { nativeSeedSQL } from '../data/finance';
import { cleaningNativeSetup } from '../data/cleaning';
export function downloadSeed() {
  const url = URL.createObjectURL(new Blob([nativeSeedSQL()], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = 'training.sql'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
interface Props { lesson: Lesson; execute(sql: string): Promise<QueryResult | null>; disabled: boolean }
export function TerminalLesson({ lesson, execute, disabled }: Props) {
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState<string[]>(['SQL Academy guided simulation. No commands run on your host operating system.', 'SQL is executed by the real browser DuckDB engine. Try .help or .tables.']);
  const [pending, setPending] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const input = command.trim(); if (!input || disabled) return;
    setCommand('');
    setHistory(h => [...h, `${pending ? '...> ' : 'D> '}${input}`]);
    if (!pending && input.startsWith('.')) {
      if (input === '.clear') { setHistory([]); return; }
      const response = input === '.help' ? `Simulated commands: .tables, .schema ${lesson.module === 4 ? 'raw_statement, .schema clean_candidates' : 'transactions'}, .mode table, .clear, .help. SQL ends with a semicolon.`
        : input === '.tables' ? lesson.module === 4 ? 'clean_candidates  raw_statement' : 'accounts  budgets  categories  payees  transactions'
        : input === '.schema raw_statement' && lesson.module === 4 ? 'raw_statement: source_row VARCHAR, posted_on VARCHAR, payee VARCHAR, category VARCHAR, amount VARCHAR, reference VARCHAR'
        : input === '.schema clean_candidates' && lesson.module === 4 ? 'clean_candidates: source_row INTEGER, posted_date DATE, payee_name VARCHAR, category_name VARCHAR, amount DECIMAL(12,2), reference VARCHAR'
        : input === '.schema transactions' && lesson.module !== 4 ? 'transactions: id INTEGER PRIMARY KEY, date DATE, account_id INTEGER, payee_id INTEGER, payee VARCHAR, category_id INTEGER, category VARCHAR, amount DECIMAL(12,2), description VARCHAR, transfer_id INTEGER, duplicate_of INTEGER'
        : input === '.mode table' ? 'Simulation displays results as a table in the grid below.' : 'This dot command is not simulated. Use .help.';
      setHistory(h => [...h, response]); return;
    }
    if (!pending && /^(sudo|duckdb|python3?|node|npm|npx|pip3?|uv|brew|winget|choco|apt(-get)?|dnf|yum|pacman|zypper|ls|dir|cd|curl|wget)\b/i.test(input)) {
      setHistory(h => [...h, 'That is a shell command. Run it in your computer’s terminal using the instructions below.']); return;
    }
    const sql = `${pending}${pending ? '\n' : ''}${input}`;
    if (!sql.endsWith(';')) { setPending(sql); setHistory(h => [...h, 'Statement buffered. Finish it with a semicolon to run.']); return; }
    setPending('');
    const result = await execute(sql);
    setHistory(h => [...h, result ? `${result.rows.length.toLocaleString('en-GB')} actual rows returned. See the results grid and task feedback below.` : 'Query failed. See the SQL error below.']);
  };
  return <div className="terminal-lesson">
    <span className="eyebrow">GUIDED SIMULATION</span><h3>Practise the CLI rhythm</h3><p>{lesson.terminal}</p>
    <div className="terminal-screen"><div className="terminal-title"><span aria-hidden="true">● ● ●</span> Simulated DuckDB prompt · browser only</div><pre aria-live="polite">{history.join('\n')}</pre>
      <form onSubmit={e => void submit(e)}><label htmlFor="terminal-command">{pending ? '...>' : 'D>'}</label><input id="terminal-command" aria-label="Simulated terminal command" autoComplete="off" spellCheck={false} value={command} onChange={e => setCommand(e.target.value)} disabled={disabled}/><button disabled={disabled || !command.trim()}>Enter</button></form>
    </div>
    {pending && <button onClick={() => { setPending(''); setHistory(h => [...h, 'Buffered statement discarded.']); }}>Discard buffered statement</button>}
    <details className="native-instructions" open><summary>Run DuckDB in your own terminal</summary>
      <h4>Install the DuckDB command-line client</h4>
      <p>Open the <a href="https://duckdb.org/docs/stable/installation/" target="_blank" rel="noreferrer">official DuckDB installation guide</a>, choose the <strong>Command line</strong> client and your operating system, then follow the instructions there.</p>
      <p>Check your installed version in your computer’s terminal and compare it with the releases on that page. Package-manager versions can differ.</p>
      <pre>duckdb --version</pre>
      {lesson.module === 4 ? <>
        <h4>Prepare the Module 4 practice database</h4>
        <p>Download statement.csv, statement.parquet and cleaning-setup.sql from the practice box on this page. Save them in one folder, then open a terminal in that folder using your file manager or the cd command with your own folder path.</p>
        <p>Start DuckDB with a fresh database filename:</p>
        <pre>duckdb cleaning.duckdb</pre>
        <p>At the DuckDB prompt, load the setup and explore:</p>
        <pre>.read cleaning-setup.sql{'\n'}.tables{'\n'}.schema raw_statement{'\n'}.mode table</pre>
        <p>Run the setup once; it deliberately fails if raw_statement already exists. It recreates the matching raw table, prepared view and Parquet extract from the CSV.</p>
        <details><summary>Reveal native setup SQL</summary><pre className="sql-block"><code>{cleaningNativeSetup()}</code></pre></details>
        <p>Now run your lesson’s query. Type <code>.quit</code> at the DuckDB prompt to exit.</p>
      </> : <>
        <h4>Prepare the practice database</h4>
        <ol>
          <li>Download the matching data:<button onClick={downloadSeed}>Download matching training.sql</button><p>Save it in a folder, then open a terminal in that folder using your file manager or the cd command with your own folder path.</p></li>
          <li>Start DuckDB with a fresh database filename:<pre>duckdb academy.duckdb</pre></li>
          <li>At the DuckDB prompt, load the script and explore:<pre>.read training.sql{'\n'}.tables{'\n'}.schema transactions{'\n'}.mode table{'\n'}SELECT * FROM transactions LIMIT 5;</pre><p>Run the setup once. The script deliberately fails if its tables already exist. Type <code>.quit</code> to exit DuckDB.</p></li>
          <li>Try this lesson’s query. Use the SQL tab to write it, or reveal the solution when you need it. The browser and downloaded seed use the same data.</li>
        </ol>
        <details><summary>Optional: practise CSV export and import</summary><pre>{"COPY (SELECT date, payee, amount FROM transactions LIMIT 100)\nTO 'sample.csv' (HEADER, DELIMITER ',');\nCREATE TABLE imported_sample AS\nSELECT * FROM read_csv('sample.csv', header = true);\nSELECT * FROM imported_sample LIMIT 5;"}</pre><p>Run these SQL statements in your local practice database. The browser editor accepts SELECT only.</p></details>
      </>}
      <p><code>duckdb --version</code> and <code>duckdb {lesson.module === 4 ? 'cleaning.duckdb' : 'academy.duckdb'}</code> run in your computer’s terminal. Dot commands and SQL run at the DuckDB prompt. This browser tab is a simulation and does not install software or execute commands on your computer.</p>
      <p>Reference: <a href="https://duckdb.org/docs/stable/clients/cli/overview" target="_blank" rel="noreferrer">DuckDB CLI documentation</a>.</p>
    </details>
  </div>;
}

import { useState, type FormEvent } from 'react';
import type { Lesson, QueryResult } from '../types';
import { nativeSeedSQL } from '../data/finance';
export function downloadSeed() {
  const url = URL.createObjectURL(new Blob([nativeSeedSQL()], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = 'training.sql'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
interface Props { lesson: Lesson; execute(sql: string): Promise<QueryResult | null>; disabled: boolean }
export function TerminalLesson({ lesson, execute, disabled }: Props) {
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState<string[]>(['DuckDB Academy guided simulation. No commands run on your host operating system.', 'SQL is executed by the real browser DuckDB engine. Try .help or .tables.']);
  const [pending, setPending] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const input = command.trim(); if (!input || disabled) return;
    setCommand('');
    setHistory(h => [...h, `${pending ? '...> ' : 'D> '}${input}`]);
    if (!pending && input.startsWith('.')) {
      if (input === '.clear') { setHistory([]); return; }
      const response = input === '.help' ? 'Simulated commands: .tables, .schema transactions, .mode table, .clear, .help. SQL ends with a semicolon.'
        : input === '.tables' ? 'accounts  budgets  categories  payees  transactions'
        : input === '.schema transactions' ? 'transactions: id INTEGER PRIMARY KEY, date DATE, account_id INTEGER, payee_id INTEGER, payee VARCHAR, category_id INTEGER, category VARCHAR, amount DECIMAL(12,2), description VARCHAR, transfer_id INTEGER, duplicate_of INTEGER'
        : input === '.mode table' ? 'Simulation displays results as a table in the grid below.' : 'This dot command is not simulated. Use .help.';
      setHistory(h => [...h, response]); return;
    }
    if (!pending && /^(sudo|pacman|duckdb|python|ls|cd|curl|wget)\b/.test(input)) {
      setHistory(h => [...h, 'That is a real shell command. Run it in your own CachyOS terminal using the instructions below.']); return;
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
    <details className="native-instructions" open><summary>Run this on your own CachyOS terminal</summary>
      <p>These commands are instructions for your real computer. This app does not install software or execute shell commands.</p>
      <ol>
        <li>Check availability, then install using your normal CachyOS package workflow:<pre>pacman -Si duckdb{'\n'}sudo pacman -Syu duckdb{'\n'}duckdb --version</pre><p>The official Arch Extra repository and CachyOS package index list DuckDB. Verify the package on your system first. If it is unavailable, follow the <a href="https://duckdb.org/docs/stable/installation/" target="_blank" rel="noreferrer">official DuckDB installation guide</a> for a Linux CLI binary. Do not run an unreviewed downloaded script.</p></li>
        <li>Download the seed and move to its directory:<button onClick={downloadSeed}>Download matching training.sql</button><pre>cd ~/Downloads{'\n'}duckdb academy.duckdb &lt; training.sql</pre><p>Use a fresh filename. The seed deliberately fails if its tables already exist, protecting an existing database.</p></li>
        <li>Open the training database and explore:<pre>duckdb academy.duckdb{'\n'}.tables{'\n'}.schema transactions{'\n'}.mode table{'\n'}SELECT * FROM transactions LIMIT 5;</pre><p><code>duckdb academy.duckdb</code> runs in your shell; the dot commands and SELECT run inside DuckDB. Exit with <code>.quit</code>.</p></li>
        <li>Try this lesson’s query. Use the SQL tab to write it, or reveal the solution when you need it. CLI and browser data are generated from the same seed.</li>
        <li>Export a small CSV, then import it into a separate practice table:<pre>{"COPY (SELECT date, payee, amount FROM transactions LIMIT 100)\nTO 'sample.csv' (HEADER, DELIMITER ',');\nCREATE TABLE imported_sample AS\nSELECT * FROM read_csv('sample.csv', header = true);\nSELECT * FROM imported_sample LIMIT 5;"}</pre><p>These write-enabled commands belong in your native training database. The browser editor accepts SELECT only.</p></li>
      </ol>
      <p>Sources: <a href="https://archlinux.org/packages/extra/x86_64/duckdb/">Arch package</a>, <a href="https://packages.cachyos.org/package/extra/x86_64/duckdb">CachyOS package</a>, <a href="https://duckdb.org/docs/stable/clients/cli/overview">DuckDB CLI documentation</a>. Availability checked 11 October 2026; local repositories can differ.</p>
    </details>
  </div>;
}

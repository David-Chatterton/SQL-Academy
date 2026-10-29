import { useState } from 'react';
import { statementCSV, cleaningNativeSetup } from '../data/cleaning';
export function downloadPracticeFile(name: string, content: string | Uint8Array) {
  const body = typeof content === 'string' ? content : new Uint8Array(content).buffer;
  const url = URL.createObjectURL(new Blob([body], { type: typeof content === 'string' ? 'text/plain;charset=utf-8' : 'application/octet-stream' }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function CleaningFiles({ ready, downloadFile }: { ready: boolean; downloadFile(name: 'statement.csv' | 'statement.parquet'): Promise<Uint8Array> }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const parquet = async () => {
    setBusy(true); setError('');
    try { downloadPracticeFile('statement.parquet', await downloadFile('statement.parquet')); }
    catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); }
    finally { setBusy(false); }
  };
  return <section className="cleaning-files" aria-label="Module 4 practice files">
    <h3>Practice files and workspace</h3>
    <p>This separate practice database contains 12 raw statement rows and a prepared clean_candidates view. The three-row Parquet extract demonstrates stored types. Your queries leave the source files unchanged.</p>
    <div className="assistance"><button onClick={() => downloadPracticeFile('statement.csv', statementCSV())}>Download statement.csv</button><button disabled={!ready || busy} onClick={() => void parquet()}>{busy ? 'Preparing download…' : 'Download statement.parquet'}</button><button onClick={() => downloadPracticeFile('cleaning-setup.sql', cleaningNativeSetup())}>Download cleaning-setup.sql</button></div>
    {error && <p role="alert">{error}</p>}
    <details><summary>Workspace columns and preparation</summary>
      <p><code>raw_statement</code>: source_row, posted_on, payee, category, amount, reference — all VARCHAR.</p>
      <p><code>clean_candidates</code>: source_row INTEGER, posted_date DATE, payee_name VARCHAR, category_name VARCHAR, amount DECIMAL(12,2), reference VARCHAR. This view retains every source row, with NULL conversion failures.</p>
      <p><code>statement.parquet</code>: source_row INTEGER, posted_date DATE, payee VARCHAR, amount DECIMAL(12,2), reference VARCHAR. It contains source rows 1, 3 and 5.</p>
      <details><summary>Reveal the prepared view’s SQL</summary><pre className="sql-block"><code>{cleaningNativeSetup()}</code></pre></details>
    </details>
  </section>;
}

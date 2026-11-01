import type { Lesson } from '../types';
import { rawStatementSQL, cleanCandidatesSQL } from '../data/cleaning';
import { downloadPracticeFile } from './CleaningFiles';
import { downloadSeed } from './TerminalLesson';
const cleaningSetup = `-- SQL Academy: DBeaver setup for Module 4.\n-- Replace /absolute/path/to/statement.csv with the downloaded CSV's full path.\n-- Use forward slashes, including on Windows. Keep the single quotes.\n-- Run once in a fresh cleaning.duckdb connection using Execute SQL Script.\nBEGIN TRANSACTION;\n${rawStatementSQL.replace("'statement.csv'", "'/absolute/path/to/statement.csv'")}\n${cleanCandidatesSQL}\nCOMMIT;\n`;
export function DBeaverLesson({ lesson }: { lesson: Lesson }) {
  const cleaning = lesson.module === 4;
  return <div className="dbeaver-lesson">
    <span className="eyebrow">DESKTOP GUI GUIDE</span><h3>Explore the practice database in DBeaver</h3>
    <p>Follow these steps to create a practice database and explore it in DBeaver.</p>
    <ol className="dbeaver-steps">
      <li><h4>Create a database connection</h4>
        <p>Open <a href="https://dbeaver.io/download/" target="_blank" rel="noreferrer">DBeaver Community</a>. Choose <strong>Database → New Database Connection</strong>, select <strong>DuckDB</strong>, then <strong>Next</strong>.</p>
        <p>In the database path field, enter the full path for a new file named <code>{cleaning ? 'cleaning.duckdb' : 'academy.duckdb'}</code> in a folder you can write to. Select <strong>Test Connection</strong>, download the driver when prompted, then select <strong>Finish</strong>.</p>
      </li>
      <li><h4>Download the practice data</h4>
        {cleaning ? <>
          <p>Use the practice-file buttons in the left pane to save <code>statement.csv</code> and <code>statement.parquet</code> to your computer. Download the setup script below too.</p>
          <button onClick={() => downloadPracticeFile('dbeaver-cleaning-setup.sql', cleaningSetup)}>Download DBeaver cleaning setup</button>
        </> : <>
          <p>Download this SQL script. It creates the tables and fills them with the course’s practice data.</p>
          <button onClick={downloadSeed}>Download matching training.sql</button>
        </>}
      </li>
      <li><h4>Load the data</h4>
        <p>Right-click your connection and choose <strong>SQL Editor → New SQL Script</strong>. Paste the contents of <code>{cleaning ? 'dbeaver-cleaning-setup.sql' : 'training.sql'}</code> into the editor.</p>
        {cleaning && <>
          <p>Replace <code>/absolute/path/to/statement.csv</code> in the script with the full path to your downloaded CSV. Keep the single quotes and use forward slashes.</p>
          <details><summary>Example file paths</summary><p>Windows: <code>C:/Users/yourname/Downloads/statement.csv</code><br/>Linux: <code>/home/yourname/Downloads/statement.csv</code><br/>macOS: <code>/Users/yourname/Downloads/statement.csv</code></p></details>
        </>}
        <p>Choose <strong>SQL Editor → Execute SQL Script</strong> to run the whole script. Wait for it to finish, then right-click the connection and select <strong>Refresh</strong>. Run the setup only once for this database.</p>
      </li>
      <li><h4>Explore your database</h4>
        <p>Expand the connection in Database Navigator, then its schemas and tables. Open a table and select its <strong>Data</strong> tab to browse the rows.</p>
        {cleaning ? <>
          <p>You will find the <code>raw_statement</code> table with 12 rows and the <code>clean_candidates</code> view. For CSV and Parquet queries, use your files’ full local paths in DBeaver.</p>
          <details><summary>Show starter queries for Module 4</summary><pre className="sql-block"><code>{"SELECT COUNT(*) AS source_rows\nFROM raw_statement;\n-- Expected: 12\n\nSELECT *\nFROM clean_candidates\nORDER BY source_row\nLIMIT 5;\n\n-- Replace this placeholder with your downloaded file's full path.\nSELECT *\nFROM read_parquet('/absolute/path/to/statement.parquet');\n-- Expected: 3 rows"}</code></pre></details>
        </> : <>
          <p>You will find <code>accounts</code>, <code>budgets</code>, <code>categories</code>, <code>payees</code> and <code>transactions</code>. The transactions table has 10,000 rows.</p>
          <details><summary>Show starter queries for Modules 1–3</summary><pre className="sql-block"><code>{"SELECT COUNT(*) AS transaction_count\nFROM transactions;\n-- Expected: 10000\n\nSELECT id, date, payee, amount\nFROM transactions\nORDER BY id\nLIMIT 20;"}</code></pre></details>
        </>}
        <p>To write a query, open another SQL script and choose <strong>SQL Editor → Execute SQL Statement</strong> to run it. Try the task for “{lesson.title}”.</p>
      </li>
    </ol>
    <p>Run your answer in the browser to record lesson completion. DBeaver results and edits do not synchronise with this course.</p>
    <details className="dbeaver-troubleshooting"><summary>Troubleshooting</summary>
      <ul>
        <li><strong>No tables showing:</strong> check that you ran the whole setup script on the correct connection, then refresh it.</li>
        <li><strong>Tables already exist:</strong> the setup has already been run. Continue to exploring the tables.</li>
        <li><strong>Database file is locked:</strong> close other applications using the file, then reconnect.</li>
        {cleaning && <li><strong>CSV or Parquet not found:</strong> check the full path to the downloaded file.</li>}
        <li><strong>Driver download fails:</strong> follow the manual driver installation steps in the DuckDB guide below.</li>
      </ul>
    </details>
    <p className="muted">Official guides: <a href="https://duckdb.org/docs/stable/guides/sql_editors/dbeaver" target="_blank" rel="noreferrer">DuckDB with DBeaver</a> · <a href="https://dbeaver.com/docs/dbeaver/SQL-Execution/" target="_blank" rel="noreferrer">DBeaver SQL execution</a> · <a href="https://duckdb.org/docs/stable/connect/concurrency" target="_blank" rel="noreferrer">DuckDB file access</a>. Menu labels can vary by version.</p>
  </div>;
}

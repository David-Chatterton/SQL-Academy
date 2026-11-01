# SQL Academy v0.1

**Learn practical SQL with DuckDB.** An independent SQL learning project using fictional financial data. The course teaches transferable SQL concepts through DuckDB; some file-reading functions, syntax and tooling are specific to DuckDB.

A local, browser-based SQL learning application for an Excel-experienced beginner. Modules 1–4 contain 32 lessons: SQL fundamentals, aggregation, relational joins, and importing/cleaning statement data. Modules 5–8 are a clearly labelled roadmap.

## Run locally

Install Node.js **22.13+ within the 22 series, or Node.js 24+**, and npm, then run in this directory:

```sh
npm install
npm run dev
```

Open the Vite URL printed in the terminal. This is a Vite / React / strict TypeScript application using Tailwind CSS, DuckDB-Wasm, Monaco, Recharts and React Flow. No backend, login or real bank data is required. Once installed and served, the core lesson workspace loads its DuckDB and Monaco assets from the application itself, without CDN dependencies. External documentation links need internet access.

If using fnm to manage Node.js, ensure it is initialised in your shell before running the installation commands.

## Checks and production build

```sh
npm run check:core
npm run test
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
npm run preview
```

`test` runs Vitest unit tests and real DuckDB-Wasm SQL integration tests under Node. `test:e2e` starts Vite and exercises real browser DuckDB, all eight solutions, error recovery, alternate queries, persistence, reset, terminal simulation, seed download and mobile navigation. Browser installation needs network access. `build` type-checks before creating `dist/`. Deploy the contents of `dist/` through a static HTTP host with correct JavaScript and WebAssembly MIME types; do not open `index.html` using `file://`.

## What is implemented

- 32 structured lessons across Modules 1–4 with objectives, beginner explanations, Excel equivalents, syntax breakdowns, tasks, editable queries, hints, solutions and solution explanations.
- DuckDB-Wasm running in a worker, seeded on initialisation, with real results and SQL errors, cancellation on reset, initialisation/query timeouts and resource disposal.
- SELECT-only workflow, external access disabled, configuration locked and learner transactions rolled back.
- Monaco SQL editor, plain-text accessible alternative, Run Query, Ctrl/Command+Enter, copy and reset controls, paginated results with column types.
- Interactive teaching samples for column selection, row filtering, ranges, AND/OR, sorting and unique values. Samples are explicitly distinguished from actual query results.
- Guided terminal simulation plus native CachyOS instructions and an identical downloadable SQL seed.
- Independent learning progress storage, dashboard, monthly spending chart with an accessible table, draggable schema diagram, responsive navigation and system/light/dark themes.

See verification status below for checks completed and the remaining browser verification.

## Database

A fixed linear congruential random generator (seed `20260101`) produces exactly 10,000 transactions from 1 January 2024 to 31 December 2025. JavaScript generation uses integer pence; SQL storage uses **DECIMAL(12,2)**. Negative amounts are outflows; positive amounts are inflows. Currency is GBP. Savings transfers and credit card repayments have two matching opposite entries sharing a `transfer_id`; they are not spending or income when analysing across your own accounts.

| Table | Purpose |
| --- | --- |
| `accounts` | Current accounts, savings and credit card; primary key `id` |
| `categories` | Twelve spending/income categories; primary key `id` |
| `payees` | Canonical payees with a default category relationship |
| `transactions` | Date, relationship IDs, original payee/category text, exact amount and cleaning markers |
| `budgets` | Monthly category allocations using exact decimal amounts |

Transactions retain payee/category text to let beginners query without joins. IDs prepare the curriculum for relational modelling. Controlled whitespace/case variants, duplicated business records (with different primary keys), missing categories and paired transfers prepare later cleaning lessons. The generated activity volume and anomalies are intentionally educational; this is not a model household's recommended spending.

Database state is recreated deterministically on reload or Reset database. The public name is SQL Academy; the existing storage keys are retained so earlier progress and theme preferences remain available. Progress is saved independently in `localStorage` under `duckdb-academy:progress:v1`. Reset learning progress changes only that key; it never clears unrelated storage or theme preferences. Completion means a successful checked query, including a revealed solution that the learner subsequently runs.

## Native CLI practice

Download `training.sql` using the app's SQL seed control, or generate it:

```sh
npm run seed
duckdb academy.duckdb < training.sql
duckdb academy.duckdb
```

Use a fresh database. The seed is wrapped in a transaction and intentionally does not drop existing tables. Browser and CLI use the same schema and generator, rather than two independent datasets. Check `pacman -Si duckdb` on CachyOS before installing; the app links official package and installation documentation. The simulated terminal runs SQL in browser DuckDB and never executes host shell commands.

## Add lessons

Add a lesson object to `src/content/lessons.ts` conforming to `Lesson` in `src/types.ts`. Define the objectives, explanation, visual type, task, starter, reference solution, hints, expected ordering and any required technique. The reference query executes against the same actual database to establish expected results. Add acceptance and rejection cases and extend browser coverage. The module registry in `src/content/lessons.ts` drives navigation and reporting; additional modules live in `src/content/module2.ts`, `module3.ts` and `module4.ts`. Add future modules to that registry.

## Verification status in the implementation environment

Verified on 28 October 2026 with the installed dependency tree:

- Core smoke check, ESLint, TypeScript and Vite production build passed.
- All 83 Vitest tests across nine files passed, including real DuckDB-Wasm execution of Modules 1–4, independent calculations, incorrect-answer rejection, isolated fixture access, progress compatibility and native-setup parity. The 14 cleaning integration checks also passed with the fallback MVP engine.
- All nine Chromium Playwright tests passed, including all 32 reference solutions, completion persistence, module transitions, optional syntax, editor reset, terminal and visual practice, practice-file downloads, workspace switching and mobile navigation. Desktop and mobile screenshots were inspected in both light and dark themes.
- The build still reports a large JavaScript chunk warning. No fresh dependency audit or deployment was performed.

The simulated terminal never executes host shell commands. Native-seed parity is checked with the same DuckDB-Wasm engine; this does not replace testing a separately installed native CLI version.

## Module 4 practice workspace

Module 4 uses a separate disposable database with a fixed 12-row statement fixture. Read the real CSV and Parquet files, inspect parsing failures, standardise text, review rejected rows, deduplicate business records and build a clean spending report. Its practice box downloads the matching CSV, Parquet and native setup SQL. Query and database resets preserve course progress. Switching to earlier modules recreates their original financial database.

Parquet support uses the signed local extension assets in `public/duckdb-extensions`; these match DuckDB v1.4.3 in the installed WASM package. Keep both variants aligned with future engine upgrades. Learner queries can read only the supplied fixture files; arbitrary uploads, remote reads and persistent SQL writes are not enabled.

## Explore in DBeaver

The lesson practice pane includes a DBeaver guide alongside Visual, SQL editor and Terminal. It gives a standalone GUI workflow: create a DuckDB connection, download the practice data, run the setup script, then browse tables and write queries. No command-line setup is required. The guide links official setup and execution documentation. Browser and desktop copies are independent; run a task in the browser to record course completion.

For Module 4, download the statement fixtures from the practice box. The DBeaver guide supplies a separate `dbeaver-cleaning-setup.sql` download: edit its CSV placeholder to an absolute local path, then execute the whole script in a fresh `cleaning.duckdb` connection. It creates the raw table and prepared view without overwriting the downloaded Parquet extract. Direct CSV/Parquet lesson queries in DBeaver need local absolute paths.

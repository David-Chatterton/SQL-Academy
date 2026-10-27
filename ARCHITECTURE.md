# Architecture

## Layers

`src/content/lessons.ts` is structured curriculum content; `src/types.ts` defines its contract. `src/data/finance.ts` provides seeded generation, exact SQL literals and the shared browser/native schema. `src/engine/` owns query safety, DuckDB lifecycle, Arrow decoding and result comparison. Hooks connect that logic to React; components handle presentation and teaching interactions.

```
Structured lessons ───────────────┐
Deterministic dataset ──> DuckDB worker ──> Arrow decoding ──> Result validation
        └──> native SQL download          └──> paginated results grid
Progress in localStorage <───────────────────── successful validation
```

## DuckDB-Wasm lifecycle

Vite imports the npm-distributed MVP and exception-handling WASM/worker assets as local URLs. `selectBundle` chooses a supported single-worker build. No SharedArrayBuffer, multithreaded bundle or cross-origin isolation is required. The worker is constructed directly from a same-origin served script. `AsyncDuckDB.instantiate`, `open` and `connect` precede seeding. Seeding uses a transaction with batches of 500 exact SQL row literals. A seed error rolls back and disposes the database.

A 60-second preparation deadline and a 15-second query deadline surface failures instead of leaving an indefinite spinner. Reset or disposal rejects the current operation and terminates a busy worker immediately; idle disposal closes the connection before terminating the database and worker. An invalidated database must be reinitialised. Query calls are serialised by the adapter and workspace. An ordinary SQL error rolls back its transaction and leaves the connection available.

Query materialisation is capped at 50,000 rows and DuckDB's memory limit is set to 128 MB. This is a local learning environment, not an arbitrary SQL hosting service. Large products can still exhaust resources before result materialisation; the worker deadline offers recovery.

## Reference protection

The academy accepts one SELECT statement, optionally ending in a semicolon. A lexer distinguishes quoted text, quoted identifiers, symbols and nested comments. It rejects write/configuration keywords, stacked statements and functions outside a small approved set. DuckDB performs actual syntax parsing. External filesystem/network access is disabled after seeding and configuration is locked. Every learner query is executed inside a transaction that is rolled back even on SQL error.

This is deliberately a restricted SELECT workspace, not a complete DuckDB SQL parser or general-purpose SQL security boundary. CTEs, dot commands, imports, extension loading and writes are not supported in the editor. Filters, ranges, ordering, aggregate functions, GROUP BY, HAVING and CASE expressions are supported for Modules 1 and 2. Later write-enabled lessons should use separate, disposable exercise databases, not weaken this guard.

## Exact amounts and Arrow

The generator never constructs financial amounts using approximate pound values. Integer pence are formatted directly into exact SQL decimal literals. DuckDB conversion flags preserve decimals and 64-bit integers. Arrow decimal limbs are reconstructed as signed 128-bit integers with BigInt and rendered as exact decimal strings. Date columns render as ISO dates. Result tables preserve column names and Arrow data type descriptions; nonnumeric outputs are not coerced to numbers for grading.

## Validation

The learner's actual result is compared with a fresh execution of the lesson's reference SQL. Columns must have the requested names and order, compatible numeric types (or matching nonnumeric types) and matching values. Non-ordered lessons compare sorted row keys as multisets, preserving duplicate counts and distinguishing NULL from zero or text. Ordered lessons compare row sequences. Numeric values are normalised without rounding exact decimal strings. Optional technique checks look for token sequences outside comments and literals.

Technique checks are lexical, not semantic AST analysis; the data comparison supplies the primary correctness test. They are a teaching aid rather than proof of how DuckDB optimised a query. Displaying a hint or solution does not set completion. Running a revealed solution and getting a correct result does, and the UI explains that behaviour.

## Progress, theme and reset

Versioned progress contains the current lesson and completion timestamps. Reads sanitise unknown IDs, malformed JSON and invalid timestamps. Storage failures are handled without crashing, with an explanatory banner on save failure. Progress updates use the previous state so an earlier query cannot overwrite a newer lesson selection. Database state is intentionally not persisted; reloads seed a fresh instance. Reset database leaves learning progress intact. Reset learning progress affects only the academy progress key. The independent theme key respects system preferences unless overridden.

## Interface and education

The persistent curriculum sidebar shows available lessons and plain, non-clickable planned modules. Explanation, Excel equivalents and independent task panels sit alongside Visual, SQL editor and Terminal tabs. Monaco is bundled locally, with a plain textarea alternative and keyboard execution in both. Tab controls support arrow keys, Home and End. Results are paginated in groups of 50; all actual rows are available, not a fabricated preview.

Visual teaching samples come directly from the same generator and are labelled as selected samples. Their interactions illustrate logical column projection, row matching, sorting and distinct values, not physical query plans. Generated visual SQL can execute against all records in DuckDB. Recharts visualises the deterministic dataset on the dashboard with a table alternative. React Flow renders relationships without implying that beginners already know joins.

The terminal is explicitly a simulation: supported dot commands produce labelled guided responses, while SQL uses the actual browser engine and shared validation. Shell commands are redirected to native instructions. Seed download and the command-line export script both use `nativeSeedSQL()`, ensuring browser/native parity.

## Extending beyond v0.1

The lesson content contract supports additional tasks without writing dedicated lesson components. The `modules` registry in `src/content/lessons.ts` drives lesson navigation, module counts, dashboard totals and next-lesson transitions. Module 2 content is in `src/content/module2.ts`, with an interactive aggregate preview in `AggregateVisual.tsx`. Existing version 1 progress is preserved: Module 1 IDs are stable, Module 2 adds new IDs and the stored shape is unchanged. For additional modules, extend the registry, define visual handlers and add per-lesson database policies. Implement separate mutable exercise instances for imports/writes. Native CLI instructions should continue using the same schema and seed, with versioned migrations when schemas change.

## Sources and validation limits

Implementation APIs were checked against [DuckDB-Wasm instantiation](https://duckdb.org/docs/stable/clients/wasm/instantiation), [configuration types](https://github.com/duckdb/duckdb-wasm/blob/main/packages/duckdb-wasm/src/bindings/config.ts), [worker lifecycle source](https://github.com/duckdb/duckdb-wasm/blob/main/packages/duckdb-wasm/src/parallel/async_bindings.ts), [DuckDB security configuration](https://duckdb.org/docs/stable/operations_manual/securing_duckdb/overview), [Tailwind's Vite setup](https://tailwindcss.com/docs/installation/using-vite), [Monaco documentation](https://microsoft.github.io/monaco-editor/docs.html) and [Recharts installation](https://recharts.github.io/en-US/guide/installation/).

On 25 October 2026, the installed dependency tree passed the core smoke check, lint, TypeScript/production build, all 45 Vitest tests and all six Chromium Playwright tests. A shared Arrow table decoder is used by the browser adapter and real Node WASM integration tests. Adapter lifecycle unit tests use mocked bindings; integration tests execute actual SQL and compare Module 2 reports with independent integer-pence calculations. Browser tests execute all 16 lesson solutions and verify progress, module transitions, optional syntax, terminal/visual practice and mobile navigation. Desktop and mobile screenshots were inspected in both themes. Native-seed parity uses DuckDB-Wasm and does not verify a separately installed native CLI. The production build retains its large-chunk warning.

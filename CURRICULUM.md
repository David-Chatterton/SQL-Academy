# Curriculum

The learner knows Excel and finance, but is not assumed to know SQL. Lessons explain each new keyword, show an Excel/Power Query connection, demonstrate the logical operation and require a query against real fictional data. All UI and teaching copy use British English.

## Module 1 — implemented in source

| Lesson | Task | Key teaching point |
| --- | --- | --- |
| 1. Understanding tables and SELECT | Retrieve all transactions | Rows, columns, types, SELECT *, FROM, statement endings |
| 2. Selecting specific columns | Show date, payee, amount | Projection changes columns, not row count |
| 3. WHERE | Grocery purchases exceeding £30 | Exact text, AND, negative outflow sign |
| 4. Comparison operators | Purchases £50–£100 inclusive | Reversed negative bounds; >=, <= and BETWEEN |
| 5. AND / OR | Groceries over £30 or restaurants over £50 | Two branches, parentheses and precedence |
| 6. ORDER BY and LIMIT | Ten largest classified outflows excluding transfers | Ascending negative amounts; stable ties on id |
| 7. DISTINCT | Unique categories including NULL | Deduplication applies to the selected row; missing is not zero |
| 8. Independent investigation | Outflows over £1,000 excluding Housing and Transfers | Translate a financial question into a complete query |

Each lesson defines prerequisites, objectives, plain-English explanations, Excel equivalents, syntax, visualisation, editable starter, actual-result validation, three progressive hints, a requested solution reveal, solution reasoning, CLI practice and completion criteria. Scaffolding decreases towards the final investigation. Prerequisites are recommendations; learners can revisit any lesson.

A strictly exceeding boundary excludes equality. Range endpoints in lesson 4 are included. Lesson 6 excludes missing categories as well as Transfers; this is stated explicitly. Lesson 7 includes a single NULL entry. Lesson 8 includes three controlled unusual purchases and does not use LIMIT. The fictional activity volume supports varied exercises; anomalous spending is an investigation signal, not evidence of wrongdoing.

## Module 2 — implemented in source

| Lesson | Task | Key teaching point |
| --- | --- | --- |
| 1. COUNT | Count all, classified and missing category rows | COUNT(*) versus COUNT(column), NULL, AS |
| 2. SUM | Positive total grocery spending | WHERE before aggregation, signed amounts, empty sums |
| 3. AVG, MIN and MAX | Average, smallest and largest grocery purchase | Positive input sizes, rounding the final average |
| 4. GROUP BY | Count and total spending per category | Report grain, NULL group, transfer exclusion |
| 5. Multiple grouping keys | Ten largest account–category totals | Group before ranking and limiting; stable ties |
| 6. HAVING | Categories spending above £20,000 | Group thresholds versus row filters |
| 7. CASE | Account inflows, outflows and net movement | Conditional aggregation, transfer exclusion, net is not balance |
| 8. Independent report | 2025 category spending with count and value thresholds | Date boundaries, inclusive count and strict total, average and order |

All eight lessons include optional syntax, three hints, reference solutions, terminal practice and actual-result validation. The aggregate Visual tab uses six labelled seeded boundary records with interactive row and group thresholds; its optional SQL runs against the full database. The sidebar tracks each module and overall progress across 32 lessons. Existing version 1 progress remains valid because Module 1 IDs and the storage format are unchanged.

SQL reference: [DuckDB aggregate functions](https://duckdb.org/docs/stable/sql/functions/aggregates) for COUNT, SUM, AVG, MIN, MAX and NULL handling. Queries are also executed against the installed DuckDB-Wasm version in integration tests.

## Module 3 — implemented in source

Eight lessons cover lookup keys, INNER JOIN, multiple lookups, LEFT JOIN, unmatched rows, ON versus WHERE, joined aggregates retaining zero-activity accounts, and an independent joined spending report. Join previews use actual seeded transactions and lookup records. Reference queries are validated against the real SQL engine.

## Module 4 — implemented in source

| Lesson | Task | Key teaching point |
| --- | --- | --- |
| 1. CSV import | Read all 12 raw statement rows | Headers, all_varchar, numeric source ordering, preserve evidence |
| 2. Parquet | Read a three-row typed extract | DATE and DECIMAL metadata; typed does not mean clean |
| 3. Amount conversion | Keep raw and parsed amounts side by side | TRY_CAST, exact decimals, invalid is not zero |
| 4. Date parsing | Parse day/month/year explicitly | TRY_STRPTIME, impossible dates, missing dates, DATE casts |
| 5. Text standardisation | Standardise payees and categories | TRIM, UPPER, NULLIF, COALESCE; missing payees remain unknown |
| 6. Quality audit | Report rejected rows and reasons | Required fields, CASE priority, traceable source identifiers |
| 7. Business duplicates | Deduplicate eligible business records | Exclude source-row IDs, retain distinct transaction references |
| 8. Cleaned report | Summarise eligible distinct purchases | Deduplicate before aggregating, exclude refunds/transfers, retain uncategorised |

The separate Module 4 workspace imports a fixed 12-row CSV into raw_statement and supplies clean_candidates, a prepared view of the parsing and standardisation expressions. It also creates a real three-row Parquet extract. Original inputs remain available. Learner queries use SELECT; setup writes occur only in the disposable practice database, which contains none of the finance tables. Switching back restores the original finance workspace. Database reset recreates practice data without erasing progress.

Learners can download statement.csv, statement.parquet and cleaning-setup.sql for a fresh native DuckDB database. This module teaches reproducible imports on supplied fixtures; arbitrary file uploads and persistent writes are outside its scope. Only those exact CSV/Parquet fixture readers are enabled, with external access disabled and configuration locked. Signed Parquet extensions matching the installed engine are bundled for both WASM variants.

The fixture reconciles to 12 imported rows: five rejected, seven eligible source rows, six distinct eligible transactions, and four report purchases after excluding a refund and transfer. The repeated TX-001 collapses while the similar TX-009 remains. Expected spending is GROCERIES £60.02, UNCATEGORISED £15.99 and TRANSPORT £5.50.

Each lesson includes objectives, Excel equivalents, optional syntax, three hints, final complete-answer reveal, terminal practice and real-result validation. The Visual tab demonstrates source, standardised, rejected, eligible and distinct stages using the same fixture. Progress across all 32 lessons retains the existing version 1 storage format and earlier lesson IDs.

SQL references: [CSV reader options](https://duckdb.org/docs/stable/data/csv/overview), [Parquet](https://duckdb.org/docs/stable/data/parquet/overview), [casting](https://duckdb.org/docs/stable/sql/expressions/cast), [date parsing](https://duckdb.org/docs/stable/sql/functions/dateformat), and [restricted file access](https://duckdb.org/docs/stable/operations_manual/securing_duckdb/overview). Tests execute these queries with the installed DuckDB-Wasm engine.

## Planned modules — no active lesson links

5. **Database management:** CREATE TABLE, INSERT, UPDATE, DELETE, views, constraints, transactions.
6. **Advanced analytical SQL:** CTEs, subqueries, window functions, balances, rolling averages, PIVOT.
7. **DuckDB CLI and Python:** native terminal, files, import/export, pandas, scripts, automation.
8. **Accounting laboratory:** reconciliation, categorisation, internal transfers, double-entry, budgets, reporting.

Use separate mutable exercise databases for Module 5. Validate new lessons with correct and subtly incorrect answers, and verify browser/native fixture parity after data or schema changes.

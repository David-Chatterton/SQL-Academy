# Bundled DuckDB Parquet extensions

Signed, unmodified official DuckDB v1.4.3 WASM Parquet extensions, matching the engine in `@duckdb/duckdb-wasm` 1.32.0. Both EH and MVP are served locally so Module 4 does not fetch an extension from a third-party server at runtime. DuckDB verifies the signatures when loading. Update these assets together with the engine, not independently.

Downloaded on 28 October 2026 using `curl --compressed` from:

- https://extensions.duckdb.org/v1.4.3/wasm_eh/parquet.duckdb_extension.wasm
- https://extensions.duckdb.org/v1.4.3/wasm_mvp/parquet.duckdb_extension.wasm

SHA-256 (uncompressed bytes):

- EH: `22765c8f7dc741cda2b571a66ac7bb355295d7d69a6c37e5315b265672984f55`
- MVP: `0785c6c95d003eff4faa7b3b4b660f02c9c92f6d68d135ddf330d42e3a650600`

Source and licensing: https://github.com/duckdb/duckdb/tree/v1.4.3/extension/parquet and https://github.com/duckdb/duckdb/blob/v1.4.3/LICENSE. DuckDB is distributed under the MIT licence; extension dependencies retain their upstream licences. See https://github.com/duckdb/duckdb/tree/v1.4.3/third_party.

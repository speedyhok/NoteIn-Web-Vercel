import initSqlJs, { type SqlJsStatic } from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

let sqlPromise: Promise<SqlJsStatic> | null = null;

export async function getSql(): Promise<SqlJsStatic> {
  if (!sqlPromise) {
    if (typeof window !== 'undefined') {
      sqlPromise = initSqlJs({
        locateFile: () => sqlWasmUrl,
      });
    } else {
      const module = await import('node:module');
      const require = module.createRequire(import.meta.url);
      const fs = require('node:fs');
      const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');
      const wasmBinary = fs.readFileSync(wasmPath);
      sqlPromise = initSqlJs({ wasmBinary });
    }
  }
  return sqlPromise;
}
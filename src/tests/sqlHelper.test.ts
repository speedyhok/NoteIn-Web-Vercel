import { describe, it, expect } from 'vitest';
import { getSql } from '../services/sqlHelper';

describe('SQL Helper', () => {
  it('loads sql.js correctly', async () => {
    const SQL = await getSql();
    expect(SQL).toBeDefined();
    const db = new SQL.Database();
    db.run("CREATE TABLE t (id INT); INSERT INTO t VALUES (42);");
    const res = db.exec("SELECT * FROM t");
    expect(res[0].values[0][0]).toBe(42);
    db.close();
  });
});
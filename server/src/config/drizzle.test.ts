import { describe, it, expect } from 'vitest';
import { sql } from './drizzle.js';

describe('Supabase Postgres connectivity', () => {
  it('runs SELECT 1 against the configured database', async () => {
    const rows = await sql`SELECT 1 AS ok`;
    expect(rows[0].ok).toBe(1);
  });

  it('reports a Postgres server version', async () => {
    const rows = await sql`SHOW server_version`;
    expect(String(rows[0].server_version).length).toBeGreaterThan(0);
  });
});

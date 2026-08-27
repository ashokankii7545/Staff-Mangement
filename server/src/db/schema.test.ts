import { describe, it, expect } from 'vitest';
import { sql } from '../config/drizzle.js';

/**
 * Schema verification – asserts the migration produced every table, the key
 * unique constraints, and a couple of representative jsonb/array columns.
 */
describe('Postgres schema', () => {
  const expectedTables = [
    'offices', 'counters', 'users', 'settings', 'holidays', 'medicine_catalog',
    'attendance', 'leave_requests', 'exemptions', 'documents', 'medicine_requests',
    'notifications', 'regularizations',
  ];

  it('creates all 13 tables', async () => {
    const rows = await sql<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;
    const names = rows.map((r) => r.table_name);
    for (const t of expectedTables) {
      expect(names, `missing table ${t}`).toContain(t);
    }
  });

  it('enforces unique constraints (users.email, users.employee_id, exemptions {user,date}) + attendance (user,date) index', async () => {
    const rows = await sql<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes WHERE schemaname = 'public'
    `;
    const idx = rows.map((r) => r.indexname);
    expect(idx).toContain('users_email_unique');
    expect(idx).toContain('users_employee_id_unique');
    // Multi-session: the old unique {user,date,type} guard is gone, replaced by
    // a plain composite (user,date) index (multiple punches per day allowed).
    expect(idx).not.toContain('attendance_user_date_type_unique');
    expect(idx).toContain('attendance_user_date_idx');
    expect(idx).toContain('exemptions_user_date_unique');
  });

  it('uses jsonb for nested fields and arrays for list fields', async () => {
    const cols = await sql<{ table_name: string; column_name: string; data_type: string }[]>`
      SELECT table_name, column_name, data_type FROM information_schema.columns
      WHERE table_schema = 'public'
        AND ((table_name = 'users' AND column_name IN ('leave_balances', 'restricted_pages', 'face_embedding'))
          OR (table_name = 'attendance' AND column_name = 'location')
          OR (table_name = 'settings' AND column_name = 'accrual_state'))
    `;
    const find = (t: string, c: string) => cols.find((x) => x.table_name === t && x.column_name === c);
    expect(find('users', 'leave_balances')?.data_type).toBe('jsonb');
    expect(find('attendance', 'location')?.data_type).toBe('jsonb');
    expect(find('settings', 'accrual_state')?.data_type).toBe('jsonb');
    expect(find('users', 'restricted_pages')?.data_type).toBe('ARRAY');
    expect(find('users', 'face_embedding')?.data_type).toBe('ARRAY');
  });
});

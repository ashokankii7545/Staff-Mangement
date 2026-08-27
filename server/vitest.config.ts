import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration. Tests run against the real Supabase Postgres using the
 * `.env` DATABASE_URL. `env.ts` calls dotenv.config() on import, so the
 * connection string is loaded automatically the first time a repo/db is
 * imported inside a test.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // DB integration tests must not run in parallel against shared tables.
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});

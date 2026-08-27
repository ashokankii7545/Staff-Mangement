import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit configuration – schema source, migration output, and the
 * Supabase Postgres credentials. `DATABASE_URL` is read from the environment.
 */
export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
    ssl: process.env.DATABASE_SSL === 'no-verify' ? { rejectUnauthorized: false } : undefined,
  },
  verbose: true,
  strict: true,
});

import * as fs from 'fs';
import * as path from 'path';
import { db } from './connection';

// ─── Migration Runner ──────────────────────────────────────────────────────────

export async function runMigrations(migrationsDir?: string): Promise<void> {
  const dir = migrationsDir ?? path.join(__dirname, 'migrations');

  // Ensure migrations table exists
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id          SERIAL PRIMARY KEY,
      filename    VARCHAR(255) NOT NULL UNIQUE,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const existing = await db.queryOne(
      `SELECT id FROM schema_migrations WHERE filename = $1`,
      [file]
    );

    if (existing) {
      console.log(`[Migration] Skipping already-applied: ${file}`);
      continue;
    }

    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    console.log(`[Migration] Applying: ${file}`);

    await db.transaction(async (client) => {
      await client.query(sql);
      await client.query(
        `INSERT INTO schema_migrations (filename) VALUES ($1)`,
        [file]
      );
    });

    console.log(`[Migration] Applied: ${file}`);
  }

  console.log('[Migration] All migrations up to date.');
}

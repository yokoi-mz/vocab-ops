import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";

const migrationsDirectory = path.join(process.cwd(), "db", "migrations");

export function runMigrations(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    ) STRICT
  `);

  const appliedVersions = new Set(
    db.prepare("SELECT version FROM schema_migrations").all().map((row) => row.version),
  );

  const migrationFiles = readdirSync(migrationsDirectory)
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort();

  for (const fileName of migrationFiles) {
    const version = fileName.slice(0, 4);
    if (appliedVersions.has(version)) {
      continue;
    }

    const sql = readFileSync(path.join(migrationsDirectory, fileName), "utf8");
    db.exec("BEGIN");
    try {
      db.exec(sql);
      db.prepare("INSERT INTO schema_migrations (version) VALUES (?)").run(version);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
}

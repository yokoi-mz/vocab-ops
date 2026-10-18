import type { DatabaseSync } from "node:sqlite";
import { openDatabase } from "./connection";
import { runMigrations } from "./migrate";

let database: DatabaseSync | undefined;

export function getDatabase(): DatabaseSync {
  if (database === undefined) {
    database = openDatabase();
    runMigrations(database);
  }
  return database;
}

import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

type DatabaseType = InstanceType<typeof Database>;

let database: DatabaseType | null = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
  source TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  flashcards TEXT NOT NULL DEFAULT '[]',
  quiz TEXT NOT NULL DEFAULT '[]',
  podcast TEXT NOT NULL DEFAULT '',
  messages TEXT NOT NULL DEFAULT '[]'
);
`;

export function open(): DatabaseType {
  if (database) return database;
  const file = process.env.DATABASE_PATH || "data/study.db";
  mkdirSync(path.dirname(file), { recursive: true });
  const connection = new Database(file);
  connection.pragma("journal_mode = WAL");
  connection.pragma("foreign_keys = ON");
  connection.exec(SCHEMA);
  database = connection;
  return database;
}

export function db(): DatabaseType {
  return open();
}

export function newId() {
  return randomUUID();
}

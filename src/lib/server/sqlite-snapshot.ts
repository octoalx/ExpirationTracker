import Database from "better-sqlite3";

/** SQLite backup API captures committed WAL data, unlike copying only the main file. */
export async function copySqliteSnapshot(source: string, destination: string) {
  const db = new Database(source, { readonly: true, fileMustExist: true });
  try { await db.backup(destination); }
  finally { db.close(); }
}

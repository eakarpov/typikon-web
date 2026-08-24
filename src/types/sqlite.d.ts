import type Database from 'better-sqlite3';

declare global {
    var _sqliteDb: ReturnType<typeof Database> | undefined;
}

import type Database from 'better-sqlite3';

declare global {
    var _rulesDb: ReturnType<typeof Database> | undefined;
}

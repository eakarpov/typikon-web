import type Database from 'better-sqlite3';
/** SQLite names an INTEGER PRIMARY KEY's bare rowid column after that key (e.g. line).
 * Always give the cursor an explicit alias, independently of the table schema. */
export function sqlitePage(db:Database.Database,table:string,after:number,limit=1000):Record<string,unknown>[] {
    if(!/^[a-z_]+$/.test(table)||!Number.isSafeInteger(after)||after<0||!Number.isSafeInteger(limit)||limit<1)throw new Error('Invalid SQLite page cursor');
    return db.prepare(`SELECT rowid AS _cursor,* FROM ${table} WHERE rowid>? ORDER BY rowid LIMIT ?`).all(after,limit) as Record<string,unknown>[];
}

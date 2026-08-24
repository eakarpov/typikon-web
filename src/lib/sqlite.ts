import Database from 'better-sqlite3';

type SqliteDb = ReturnType<typeof Database>;

// better-sqlite3 держит открытый файловый дескриптор на весь срок жизни объекта,
// поэтому соединение создаётся один раз на процесс и переиспользуется. Раньше
// каждый вызов init() открывал новый Database и почти нигде не закрывал его.
// В dev-режиме храним соединение в global — иначе hot reload пересоздаёт модуль
// (тот же приём, что и для MongoClient в @/lib/mongodb).
let db: SqliteDb | undefined;

export const init = async (): Promise<SqliteDb> => {
    if (process.env.NODE_ENV === 'development') {
        if (!global._sqliteDb) {
            global._sqliteDb = new Database(process.env.SQLITE_DB);
        }
        return global._sqliteDb;
    }

    if (!db) {
        db = new Database(process.env.SQLITE_DB);
    }
    return db;
};

import sqlite3 from 'sqlite3';
// @ts-ignore
import Database from 'better-sqlite3';
import { open } from 'sqlite';
import path from "path";

export const init = async () => {
    // const db = await open({
    //     filename: path.resolve(process.env.SQLITE_DB),
    //     driver: sqlite3.Database
    // });
    const db = new Database(process.env.SQLITE_DB);
    // await db.loadExtension('/usr/local/lib/fts5icu.dylib');

    return db;
}
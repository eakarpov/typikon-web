import {test} from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {sqlitePage} from './sqlite';
test('pagination covers INTEGER PRIMARY KEY locations beyond the first batch and keeps source payload intact',()=>{
 const db=new Database(':memory:');db.exec('CREATE TABLE locations(line INTEGER PRIMARY KEY,entryId TEXT)');
 db.transaction(()=>{for(let i=1;i<=2003;i++)db.prepare('INSERT INTO locations VALUES (?,?)').run(i*3,'entry:'+i)})();
 let last=0;const lines:number[]=[];for(;;){const rows=sqlitePage(db,'locations',last);if(!rows.length)break;
 for(const row of rows){const {_cursor,...payload}=row;assert.equal(_cursor,payload.line);assert.deepEqual(Object.keys(payload).sort(),['entryId','line']);lines.push(Number(payload.line));}
 last=Number(rows[rows.length-1]._cursor);}
 assert.equal(lines.length,2003);assert.equal(new Set(lines).size,2003);assert.equal(lines.at(-1),6009);
 assert.throws(()=>sqlitePage(db,'locations',NaN));assert.throws(()=>sqlitePage(db,'locations; DROP TABLE locations',0));db.close();
});
test('TEXT PRIMARY KEY pages retain their original content and explicit cursor',()=>{
 const db=new Database(':memory:');db.exec('CREATE TABLE entries(id TEXT PRIMARY KEY,body TEXT)');db.prepare('INSERT INTO entries VALUES (?,?)').run('id','unchanged');
 assert.deepEqual(sqlitePage(db,'entries',0),[{_cursor:1,id:'id',body:'unchanged'}]);assert.deepEqual(sqlitePage(db,'entries',1),[]);db.close();
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {horologionCanon} from './horologion';
test('Horologion chooses the canon by its own service, weekday, tone and edition',()=>{
 const db=new Database(':memory:');
 try {
  db.exec(`CREATE TABLE positions(position_id TEXT,service TEXT);
   INSERT INTO positions VALUES('canon',NULL);
   CREATE TABLE memories(memory_id TEXT,book TEXT,weekday TEXT,tone INTEGER);
   CREATE TABLE canons(canon_id TEXT,memory_id TEXT,position_id TEXT,service TEXT,language TEXT,tone INTEGER);
   INSERT INTO memories VALUES('fri','octoechos','pyatnitsa',5),('sun','octoechos','voskresenie',8);
   INSERT INTO canons VALUES('friday','fri','canon','compline','cu_gr',5),('sunday','sun','canon','midnight','cu_gr',8),('english','sun','canon','midnight','en',8);`);
  assert.equal(horologionCanon(db,'2026-11-06','compline',5)?.canon_id,'friday');
  assert.equal(horologionCanon(db,'2026-11-08','midnight',8)?.canon_id,'sunday');
  assert.equal(horologionCanon(db,'2026-11-06','midnight',5),undefined);
  assert.equal(horologionCanon(db,'2026-11-08','midnight',5),undefined);
 }finally{db.close();}
});

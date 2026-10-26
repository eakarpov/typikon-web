import { test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { saintWorks,saintService } from './saintWorks';

function corpus(){
    const db=new Database(':memory:');
    db.exec(`
    CREATE TABLE memories(memory_id TEXT PRIMARY KEY,label TEXT,book TEXT,month INT,day INT,dneslov_id TEXT);
    CREATE TABLE groups(group_id INT,memory_id TEXT,language TEXT,tone INT,service TEXT,group_label TEXT);
    CREATE TABLE content_items(item_id INT,group_id INT,canon_id TEXT,content_unit TEXT,language TEXT,text TEXT,ref_text_id TEXT,ref_item_id INT,item_index INT,inline_rubric TEXT);
    CREATE TABLE fixed_texts(text_id TEXT,text TEXT);
    CREATE TABLE canons(canon_id TEXT,memory_id TEXT,language TEXT,tone INT,service TEXT);
    INSERT INTO memories VALUES('a','Первый','menaion',1,2,'7974'),('b','Другой','menaion',1,2,'9000');
    INSERT INTO groups VALUES(1,'a','cu_gr',3,'vespers','Тропарь'),(2,'a','cu_gr',3,'matins','Кондак'),(3,'b','cu_gr',3,'matins','Чужой');
    INSERT INTO canons VALUES('canon-a','a','cu_gr',3,'matins'),('canon-b','b','cu_gr',3,'matins');
    INSERT INTO fixed_texts VALUES('fixed','Величание по ссылке');
    INSERT INTO content_items VALUES
      (1,1,NULL,'troparion','cu_gr','Тропарь',NULL,NULL,1,NULL),
      (2,2,NULL,'troparion','cu_gr','Тропарь',NULL,NULL,1,NULL),
      (3,2,NULL,'kontakion','cu_gr','Кондак',NULL,NULL,2,NULL),
      (4,2,NULL,'velichanie','cu_gr',NULL,'fixed',NULL,3,NULL),
      (5,NULL,'canon-a','troparion','cu_gr','Тропарь внутри канона',NULL,NULL,1,NULL),
      (6,3,NULL,'troparion','cu_gr','Чужое песнопение',NULL,NULL,1,NULL),
      (7,NULL,'canon-b','troparion','cu_gr','Чужой канон',NULL,NULL,1,NULL);
    ALTER TABLE content_items ADD COLUMN marker TEXT;
    ALTER TABLE canons ADD COLUMN role TEXT;
    `);
    return db;
}

test('verified identity supplies all genres and never mixes namesakes or canon stanzas into daily troparia',()=>{
    const db=corpus();try{
        const works=saintWorks(db,[],['7974']);
        assert.deepEqual(works.memoryIds,['a']);
        assert.deepEqual(new Set(works.items.map(w=>w.genre)),new Set(['troparion','kontakion','magnification','canon','service']));
        assert.equal(works.items.filter(w=>w.genre==='troparion').length,1);
        assert.ok(works.items.some(w=>w.title==='Величание по ссылке'));
        assert.ok(!works.items.some(w=>w.title.includes('Чуж')||w.title.includes('внутри канона')));
        assert.ok(works.items.some(w=>w.id==='canon-a'&&w.reader==='canon'));
        assert.deepEqual(saintWorks(db,[],['unknown']).items,[]);
    }finally{db.close();}
});

test('own provenance can link works without a Dneslov number',()=>{
    const db=corpus();try{assert.ok(saintWorks(db,['a'],[]).items.length>0);assert.deepEqual(saintWorks(db,[],[]).items,[]);}finally{db.close();}
});

test('service reader resolves references, keeps book order and provides canon links',()=>{
    const db=corpus();try{
        const service=saintService(db,'a','cu_gr');
        assert.ok(service);
        assert.deepEqual(service.rows.map((r:any)=>r.item_id),[1,2,3,4]);
        assert.equal(service.rows[3].text,'Величание по ссылке');
        assert.equal(service.canons[0].id,'canon-a');
        assert.equal(saintService(db,"a' OR 1=1 --",null),null);
        assert.ok(!service.rows.some((r:any)=>r.text.includes('Чуж')));
    }finally{db.close();}
});

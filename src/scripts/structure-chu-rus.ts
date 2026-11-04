import Database from 'better-sqlite3';
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { extractReferences, extractFrequency, unlinkedGrammar } from '@/lib/dictionaryImport/structured';
const arg=(name:string):string=>{const i=process.argv.indexOf(name);if(i<0||!process.argv[i+1])throw new Error(`Required ${name}`);return process.argv[i+1];};
const staging=arg('--staging'),source=arg('--dsl');
const db=new Database(staging,{fileMustExist:true});
try {
    const expected=(db.prepare("SELECT value FROM metadata WHERE key='sourceFileSha256'").get() as {value:string}).value;
    const packed=readFileSync(source);if(createHash('sha256').update(packed).digest('hex')!==expected)throw new Error('Source archive hash mismatch');
    if((db.prepare("SELECT value FROM metadata WHERE key='state'").get() as {value:string}).value!=='complete')throw new Error('Incomplete staging');
    db.pragma('journal_mode = WAL');db.pragma('synchronous = NORMAL');db.pragma('cache_size = -131072');
    db.exec(`CREATE TABLE IF NOT EXISTS source_references(id TEXT PRIMARY KEY,entryId TEXT NOT NULL,kind TEXT NOT NULL,target TEXT NOT NULL,offset INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS frequencies(entryId TEXT PRIMARY KEY,total INTEGER,subcorpora TEXT NOT NULL,raw TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS unresolved_grammar(entryId TEXT NOT NULL,ordinal INTEGER NOT NULL,raw TEXT NOT NULL,PRIMARY KEY(entryId,ordinal));`);
    const ref=db.prepare('INSERT OR IGNORE INTO source_references VALUES (?,?,?,?,?)');
    const freq=db.prepare('INSERT OR IGNORE INTO frequencies VALUES (?,?,?,?)');
    const unresolved=db.prepare('INSERT OR IGNORE INTO unresolved_grammar VALUES (?,?,?)');
    const batch=db.prepare('SELECT rowid,id,headers,body FROM entries WHERE rowid>? ORDER BY rowid LIMIT 1000');
    const save=db.transaction((rows:{rowid:number;id:string;headers:string;body:string}[])=>{
      for(const row of rows){for(const r of extractReferences(row.id,row.body))ref.run(r.id,r.entryId,r.kind,r.target,r.offset);
        const f=extractFrequency(row.id,row.body);if(f)freq.run(f.entryId,f.total,JSON.stringify(f.subcorpora),f.raw);
        unlinkedGrammar(row.body).forEach((raw,i)=>unresolved.run(row.id,i,raw));}
    });
    let last=0;
    for(;;){const rows=batch.all(last) as {rowid:number;id:string;headers:string;body:string}[];if(!rows.length)break;save(rows);last=rows[rows.length-1].rowid;}
    db.exec('CREATE INDEX IF NOT EXISTS dictionary_fragment_entry ON fragments(entryId);CREATE INDEX IF NOT EXISTS dictionary_reference_entry ON source_references(entryId);CREATE INDEX IF NOT EXISTS dictionary_grammar_entry ON grammar(sourceEntryId);CREATE INDEX IF NOT EXISTS dictionary_location_entry ON locations(entryId);');
    const decoded=(packed[0]===0x1f?gunzipSync(packed):packed).toString('utf8');
    const headers=decoded.slice(0,4096).split(/\r?\n/).filter(line=>line.replace(/^\uFEFF/,'').startsWith('#')).map(line=>line.replace(/^\uFEFF/,''));
    db.prepare('INSERT OR REPLACE INTO metadata VALUES (?,?)').run('dslHeaders',JSON.stringify(headers));
    db.prepare('INSERT OR REPLACE INTO metadata VALUES (?,?)').run('structuredState','complete');
    const summary={references:db.prepare('SELECT kind,count(*) count FROM source_references GROUP BY kind').all(),
      frequencies:(db.prepare('SELECT count(*) n FROM frequencies').get() as {n:number}).n,
      unlinkedGrammar:(db.prepare('SELECT count(*) n FROM unresolved_grammar').get() as {n:number}).n,
      headers,scope:'All raw articles remain unchanged. Definitions/examples remain source blocks, not automatically approved senses.'};
    writeFileSync(staging+'.structured-summary.json',JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary,null,2));
    db.pragma('wal_checkpoint(TRUNCATE)');db.pragma('journal_mode = DELETE');
} finally {db.close();}

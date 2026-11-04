import Database from 'better-sqlite3';
import { readProvenanceGraph } from '@/lib/dictionaryImport/provenance';
const arg=(name:string):string=>{const i=process.argv.indexOf(name);if(i<0||!process.argv[i+1])throw new Error(`Required ${name}`);return process.argv[i+1];};
const db=new Database(arg('--db'),{readonly:true,fileMustExist:true});
try {
 const state=db.prepare("SELECT value FROM metadata WHERE key='state'").get() as {value:string}|undefined;
 if(state?.value!=='complete')throw new Error('Provenance build is incomplete');
 const graph=readProvenanceGraph(db,arg('--lexeme'));
 console.log(JSON.stringify({...graph,sources:db.prepare('SELECT payload FROM sources').all().map(r=>JSON.parse((r as {payload:string}).payload) as unknown),versions:db.prepare('SELECT payload FROM versions').all().map(r=>JSON.parse((r as {payload:string}).payload) as unknown)},null,2));
}finally{db.close();}

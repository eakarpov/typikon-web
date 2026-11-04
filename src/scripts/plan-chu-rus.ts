import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { hashFile } from '@/lib/dictionaryImport/files';
import Database from 'better-sqlite3';
import { buildPlan } from '@/lib/dictionaryImport/plan';
import { lemmaHeader, lemmaProperties } from '@/lib/dictionaryImport/core';
import type { DslEntry, LegacyLexeme, RecoveryLexeme } from '@/lib/dictionaryImport/model';
const arg=(name:string):string=>{const i=process.argv.indexOf(name);if(i<0||!process.argv[i+1])throw new Error(`Required ${name}`);return process.argv[i+1];};
const staging=arg('--staging'),snapshot=arg('--snapshot'),recovery=arg('--recovery'),out=arg('--out');
if(existsSync(out))throw new Error('Refusing to overwrite an existing plan');
const hash=hashFile;
const db=new Database(staging,{readonly:true,fileMustExist:true});
try {
 const meta=Object.fromEntries((db.prepare('SELECT key,value FROM metadata').all() as {key:string;value:string}[]).map(r=>[r.key,r.value]));
 if(meta.state!=='complete'||meta.structuredState!=='complete')throw new Error('Source preparation is incomplete');
 const lemmaInputs:{key:string;properties:string}[]=[];
 for(const row of db.prepare("SELECT id,headers,body,line,endLine FROM entries WHERE headers LIKE '%:\"]'").iterate() as Iterable<{id:string;headers:string;body:string;line:number;endLine:number}>){
  const entry:DslEntry={...row,headers:JSON.parse(row.headers) as string[]};const key=lemmaHeader(entry);if(key)lemmaInputs.push({key,properties:lemmaProperties(entry)});
 }
 const plan=buildPlan(JSON.parse(readFileSync(snapshot,'utf8')) as LegacyLexeme[],JSON.parse(readFileSync(recovery,'utf8')) as RecoveryLexeme[],lemmaInputs,meta.sourceFileSha256,hash(staging),hash(recovery));
 writeFileSync(out,JSON.stringify(plan,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({id:plan.id,baseline:plan.baseline,insertions:plan.insertions.length,existing:plan.existing.length,held:plan.held.length,sourceLinks:plan.links.length,out},null,2));
} finally {db.close();}

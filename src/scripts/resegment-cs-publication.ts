import Database from 'better-sqlite3';
import { copyFileSync, existsSync, chmodSync, readFileSync, writeFileSync, createReadStream, statfsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname } from 'node:path';
import { resegmentArticle } from '../lib/csDictionary/resegment';
import type { Article } from '../lib/csDictionary/types';
const arg = (key: string) => { const i = process.argv.indexOf(key); if(i<0 || !process.argv[i+1]) throw Error('Missing '+key); return process.argv[i+1]; };
const hash = async (path: string) => { const h=createHash('sha256');for await(const b of createReadStream(path))h.update(b);return h.digest('hex'); };
const meta = (d: Database.Database): Record<string,string> => Object.fromEntries((d.prepare('select key,value from metadata').all() as {key:string;value:string}[]).map(x=>[x.key,x.value]));
async function main() {
 const base=arg('--base'), out=arg('--out'), expected=arg('--version'), reportPath=arg('--report');
 const resume=process.argv.includes('--resume-building');
 if(existsSync(reportPath)||(existsSync(out)&&!resume))throw Error('Output exists');
 const beforeSha=await hash(base);const source=new Database(base,{readonly:true,fileMustExist:true});const before=meta(source);
 if(before.version!==expected||before.state!=='complete')throw Error('Active publication changed');
 const disk=statfsSync(dirname(out));if(disk.bavail*disk.bsize<statSync(base).size+1024**3)throw Error('Not enough disk');
 if(!resume)copyFileSync(base,out);chmodSync(out,0o600);const db=new Database(out);
 if(meta(db).version!==expected||!['building','complete'].includes(meta(db).state)||resume&&meta(db).state!=='building')throw Error('Unsafe resume state');
 db.pragma('journal_mode=WAL');db.pragma('synchronous=NORMAL');
 const counts:Record<string,number>={};const samples:unknown[]=[];let articles=0,changedArticles=0;
 const put=db.prepare('update articles set payload=? where id=?');
 const unchanged = (x: Article) => { const copy=structuredClone(x);for(const p of copy.paradigms)for(const s of p.slots)for(const f of s.forms)delete (f as Partial<typeof f>).segments;return JSON.stringify(copy); };
 db.prepare("update metadata set value='building' where key='state'").run();
 const work=db.transaction((id:string,payload:string)=>{
  const a=JSON.parse(payload) as Article;const old=unchanged(a);const r=resegmentArticle(a);
  if(unchanged(a)!==old)throw Error('Non-segment data changed: '+id);
  for(const [key,n] of Object.entries(r.counts))counts[key]=(counts[key]??0)+n;
  if(r.counts.changed){put.run(JSON.stringify(a),id);changedArticles++;
   if(samples.length<80)samples.push({id,name:a.name,examples:r.examples});}
 });
 for(const r of source.prepare('select id,payload from articles order by id').iterate() as Iterable<{id:string;payload:string}>){
  work(r.id,r.payload);articles++;
  if(articles%1000===0)process.stdout.write(JSON.stringify({articles,changedArticles,counts})+'\n');
 }
 const version=createHash('sha256').update(JSON.stringify({format:'cs-ending-segments-v1',base:before.version,builder:await hash(process.argv[1]),counts})).digest('hex');
 db.transaction(()=>{for(const [key,value] of Object.entries({version,state:'complete',endingSegmentsBaseVersion:before.version,endingSegmentsRule:'cell-template-exact-surface-v1'}))db.prepare('insert into metadata values (?,?) on conflict(key) do update set value=excluded.value').run(key,value);})();
 if(JSON.stringify(db.prepare('pragma quick_check').all())!==JSON.stringify([{quick_check:'ok'}]))throw Error('Integrity failure');
 // Every other field of every article is preserved, including extra forms and all attestations.
 let checked=0;const get=db.prepare('select payload from articles where id=?');
 for(const r of source.prepare('select id,payload from articles order by id').iterate() as Iterable<{id:string;payload:string}>){
  const a=JSON.parse((get.get(r.id) as {payload:string}).payload) as Article;
  if(unchanged(a)!==unchanged(JSON.parse(r.payload)))throw Error('Article invariant failed: '+r.id);
  for(const p of a.paradigms)for(const s of p.slots)for(const f of s.forms)if(f.segments&&f.segments.map(x=>x.text).join('')!==f.value)throw Error('Exact surface invariant failed');
  checked++;
 }
 db.pragma('wal_checkpoint(TRUNCATE)');db.pragma('journal_mode=DELETE');
 db.close();source.close();if(await hash(base)!==beforeSha)throw Error('Base modified');chmodSync(out,0o444);
 const result={format:'cs-ending-segments-v1',base,baseVersion:before.version,baseSha256:beforeSha,candidate:out,version,sha256:await hash(out),articles,changedArticles,checkedArticles:checked,counts,samples};
 writeFileSync(reportPath,JSON.stringify(result,null,2)+'\n');process.stdout.write(JSON.stringify({complete:true,version,sha256:result.sha256,articles,changedArticles,counts})+'\n');
}
main().catch(error=>{console.error(error);process.exitCode=1;});

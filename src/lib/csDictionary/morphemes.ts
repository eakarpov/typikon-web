import Database from 'better-sqlite3';
import {createHash} from 'node:crypto';
import {resolve,dirname,join} from 'node:path';

export class MorphemeError extends Error {
 constructor(readonly status:number,readonly code:string,message:string){super(message);}
}
type Payload=Record<string,unknown>;
type WordRow={sort_key:string;lexeme_id:string;payload:string};
export class MorphemePublication {
 readonly version:string;
 readonly dictionaryVersion:string;
 constructor(readonly db:Database.Database){
  const m=Object.fromEntries((db.prepare('SELECT key,value FROM metadata').all() as {key:string;value:string}[]).map(r=>[r.key,r.value]));
  if(m.format!=='cs-morphemes-v1'||m.state!=='complete'||!m.version||!m.dictionaryVersion)throw Error('Incomplete morpheme publication');
  this.version=m.version;this.dictionaryVersion=m.dictionaryVersion;
 }
 private payload(table:'words'|'morphemes',id:string):Payload|null {
  const row=this.db.prepare(`SELECT payload FROM ${table} WHERE id=?`).get(id) as {payload:string}|undefined;
  return row?JSON.parse(row.payload) as Payload:null;
 }
 word(id:string):Payload|null{return this.payload('words',id);}
 card(id:string):Payload|null{return this.payload('morphemes',id);}
 words(id:string,size:number,cursor:string|null):Payload|null {
  if(!this.card(id))return null;
  let after=['',''];
  if(cursor!==null){
   try{
    if(cursor.length>4096||!/^[A-Za-z0-9_-]+$/.test(cursor))throw Error();
    const c=JSON.parse(Buffer.from(cursor,'base64url').toString('utf8')) as unknown[];
    if(!Array.isArray(c)||c.length!==5||c[0]!==this.version||c[1]!==id||c[2]!==size||typeof c[3]!=='string'||typeof c[4]!=='string')throw Error();
    const row=this.db.prepare('SELECT 1 FROM morpheme_words WHERE morpheme_id=? AND sort_key=? AND lexeme_id=?').get(id,c[3],c[4]);
    if(!row)throw Error();
    after=[c[3],c[4]];
   }catch{throw new MorphemeError(400,'bad_cursor','Неверный курсор страницы');}
  }
  const rows=this.db.prepare(`SELECT sort_key,lexeme_id,payload FROM morpheme_words
   WHERE morpheme_id=? AND (sort_key,lexeme_id)>(?,?) ORDER BY sort_key,lexeme_id LIMIT ?`).all(id,...after,size+1) as WordRow[];
  const page=rows.slice(0,size),last=page.at(-1);
  const count=this.db.prepare('SELECT count(*) AS n FROM morpheme_words WHERE morpheme_id=?').get(id) as {n:number};
  return {version:this.version,total:count.n,items:page.map(r=>JSON.parse(r.payload) as unknown),
   nextCursor:rows.length>size&&last?Buffer.from(JSON.stringify([this.version,id,size,last.sort_key,last.lexeme_id])).toString('base64url'):null};
 }
 etag(url:string):string{return '"'+createHash('sha256').update(this.version+'\0'+url).digest('hex')+'"';}
}
let cached:{path:string;pub:MorphemePublication}|undefined;
export function morphemePublication(version?:string):MorphemePublication {
 const active=process.env.CS_MORPHEME_DB;
 if(!active)throw Error('Morpheme publication is not configured');
 // Version is a content hash, never a caller-supplied filesystem path.
 if(version!==undefined&&!/^[a-f0-9]{64}$/.test(version))throw new MorphemeError(409,'version_expired','Версия базы недоступна. Откройте разбор заново.');
 if(cached?.path===active&&(!version||cached.pub.version===version))return cached.pub;
 const path=version&&cached?.pub.version!==version?join(dirname(resolve(active)),`morphemes-${version}.sqlite`):active;
 let db:Database.Database|undefined;
 try{
  db=new Database(path,{readonly:true,fileMustExist:true});
  const pub=new MorphemePublication(db);
  if(version&&pub.version!==version){db.close();throw new MorphemeError(409,'version_expired','Версия базы недоступна. Откройте разбор заново.');}
  if(path===active){cached?.pub.db.close();cached={path:active,pub};}
  return pub;
 }catch(error){db?.close();if(error instanceof MorphemeError)throw error;if(version)throw new MorphemeError(409,'version_expired','Версия базы недоступна. Откройте разбор заново.');throw error;}
}

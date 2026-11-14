import {NextResponse} from 'next/server';
import {consume,clientIpFromHeaders} from '@/lib/rateLimit';
import {dictionaryPublication,withDictionaryPublication} from './database';
import {dictionarySchema,dictionaryCompatibility,dictionaryError,searchV2,articleV2,legacyArticle,sourceV2} from './profile';
import type {Direction} from './types';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','X-Content-Type-Options':'nosniff'};
export const csResponse=(body:unknown,status=200,extra:Record<string,string>={}):NextResponse=>NextResponse.json(body,{status,headers:{...headers,'Cache-Control':status===200?'public, max-age=60':'no-store',...extra}});
export const csOptions=():Response=>new Response(null,{status:204,headers});
function limit(request:Request,kind:'search'|'detail'|'report'):NextResponse|null{
 const v=consume('cs:'+kind+':'+clientIpFromHeaders(request.headers),kind==='report'?5:kind==='search'?300:600,kind==='report'?3600:60);
 return v.allowed?null:csResponse({error:{code:'rate_limited',message:'Слишком много запросов'}},429,{'Retry-After':String(v.retryAfter)});
}
export async function csSearch(request:Request):Promise<Response>{
 const blocked=limit(request,'search');if(blocked)return blocked;
 const u=new URL(request.url),q=(u.searchParams.get('q')??'').trim(),d=u.searchParams.get('direction')??'cu-ru',cursor=Number(u.searchParams.get('cursor')??0),size=Number(u.searchParams.get('limit')??20);
 try{
 const schema=dictionarySchema(u),compat=dictionaryCompatibility(u);
 if(!q||!/[\p{L}\p{N}]/u.test(q)||[...q].length>120||!['cu-ru','ru-cu'].includes(d)||schema===1&&(!Number.isSafeInteger(cursor)||cursor<0||cursor>100000)||!Number.isInteger(size)||size<1||size>50)return csResponse({error:{code:'bad_request',message:'Проверьте запрос и направление поиска'}},400,compat);
 const body=schema===1?dictionaryPublication().search(q,d as Direction,cursor,size):withDictionaryPublication(u.searchParams.get('version'),p=>searchV2(p,u,q,d as Direction,size));
 return csResponse(body,200,compat);
 }catch(error){const e=dictionaryError(error);return csResponse(e.body,e.status,dictionaryCompatibility(u));}
}
export async function csArticle(request:Request,id:string):Promise<Response>{
 const blocked=limit(request,'detail');if(blocked)return blocked;if(!/^[a-f0-9]{24}$/.test(id))return csResponse({error:{code:'bad_request',message:'Неверный ID'}},400);
 const u=new URL(request.url);try{
 const schema=dictionarySchema(u),compat=dictionaryCompatibility(u);
 return withDictionaryPublication(schema===2?u.searchParams.get('version'):null,p=>{
 const relations=u.searchParams.get('view')==='relations',item=relations?p.relationView(id):p.article(id);
 if(!item)return csResponse({error:{code:'not_found',message:'Статья не найдена'}},404,compat);
 const body=relations?{...item,version:p.version,...(schema===2?{schemaVersion:2,dictionaryVersion:p.version}:{})}:schema===2?articleV2(p,item as import('./types').Article):{...legacyArticle(item as import('./types').Article),version:p.version};
 return csResponse(body,200,compat);
 });}catch(error){const e=dictionaryError(error);return csResponse(e.body,e.status,dictionaryCompatibility(u));}
}
export async function csSource(request:Request,id:string):Promise<Response>{
 const blocked=limit(request,'detail');if(blocked)return blocked;if(!/^[a-f0-9]{64}$/.test(id))return csResponse({error:{code:'bad_request',message:'Неверный ID источника'}},400);
 const u=new URL(request.url);try{const schema=dictionarySchema(u),compat=dictionaryCompatibility(u);return withDictionaryPublication(schema===2?u.searchParams.get('version'):null,p=>{const item=p.source(id);return item?csResponse(schema===2?sourceV2(p,item):{...item,publicationVersion:p.version},200,compat):csResponse({error:{code:'not_found',message:'Материал не найден'}},404,compat);});}catch(error){const e=dictionaryError(error);return csResponse(e.body,e.status,dictionaryCompatibility(u));}
}
export async function csReport(request:Request):Promise<Response>{
 const blocked=limit(request,'report');if(blocked)return blocked;
 try{
  const reader=request.body?.getReader();let data='',bytes=0;const decoder=new TextDecoder();if(reader)for(;;){const r=await reader.read();if(r.done)break;bytes+=r.value.length;if(bytes>8192){await reader.cancel();return csResponse({error:{code:'too_large',message:'Сообщение слишком длинное'}},413);}data+=decoder.decode(r.value,{stream:true});}data+=decoder.decode();
  const j=JSON.parse(data) as Record<string,unknown>;
  if(!['missing','inaccurate','morphology','source','other'].includes(String(j.reason))||typeof j.comment!=='string'||j.comment.trim().length<3||j.comment.length>2000||j.lexemeId!==undefined&&!/^[a-f0-9]{24}$/.test(String(j.lexemeId))||j.query!==undefined&&(typeof j.query!=='string'||j.query.length>120))return csResponse({error:{code:'bad_request',message:'Проверьте сообщение'}},400);
  const {default:clientPromise}=await import('@/lib/mongodb');const client=await clientPromise;
  await client.db('typikon-csl').collection('dictionaryContentReports').insertOne({reason:j.reason,comment:j.comment.trim(),lexemeId:j.lexemeId??null,query:j.query??null,status:'new',createdAt:new Date()});
  return csResponse({accepted:true},201);
 }catch(error){return csResponse({error:{code:error instanceof SyntaxError?'bad_request':'unavailable',message:'Не удалось принять сообщение'}},error instanceof SyntaxError?400:503);}
}

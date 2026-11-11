import {consume,clientIpFromHeaders} from '@/lib/rateLimit';
import {csResponse,csOptions} from './http';
import {dictionaryPublication} from './database';
import {MorphemeError,morphemePublication} from './morphemes';
export {csOptions};

type View='word'|'card'|'words';
export async function csMorphemes(request:Request,id:string,view:View):Promise<Response>{
 const rate=consume('cs:detail:'+clientIpFromHeaders(request.headers),600,60);
 if(!rate.allowed)return csResponse({error:{code:'rate_limited',message:'Слишком много запросов'}},429,{'Retry-After':String(rate.retryAfter)});
 const u=new URL(request.url);
 if(view==='word'?!/^[a-f0-9]{24}$/.test(id):!id||id.length>200||/[\x00-\x1f/\\]/.test(id))return csResponse({error:{code:'bad_request',message:'Неверный ID'}},400);
 const version=u.searchParams.get('version');
 const size=u.searchParams.get('limit')??'20';
 if(view!=='word'&&!version)return csResponse({error:{code:'bad_request',message:'Укажите версию базы'}},400);
 if(view==='words'&&(!/^[1-9][0-9]*$/.test(size)||Number(size)>100))return csResponse({error:{code:'bad_request',message:'Размер страницы должен быть от 1 до 100'}},400);
 let p:ReturnType<typeof morphemePublication>|undefined;
 try{
  p=morphemePublication(view==='word'?undefined:version!);
  if(view==='word'&&p.dictionaryVersion!==dictionaryPublication().version)throw Error('Dictionary version mismatch');
  const body=view==='word'?p.word(id):view==='card'?p.card(id):p.words(id,Number(size),u.searchParams.get('cursor'));
  if(!body)return csResponse({error:{code:'not_found',message:'Материал не найден'}},404);
  const etag=p.etag(u.href);
  if(request.headers.get('If-None-Match')===etag)return new Response(null,{status:304,headers:{'Access-Control-Allow-Origin':'*','ETag':etag,'Cache-Control':'public, max-age=60'}});
  return csResponse(body,200,{'ETag':etag});
 }catch(error){
  return error instanceof MorphemeError?csResponse({error:{code:error.code,message:error.message}},error.status):csResponse({error:{code:'unavailable',message:'Морфемная база временно недоступна'}},503);
 }finally{
  // Retained publications are request-scoped. The active publication stays cached.
  if(p&&view!=='word'&&p.db.name!==process.env.CS_MORPHEME_DB)p.db.close();
 }
}

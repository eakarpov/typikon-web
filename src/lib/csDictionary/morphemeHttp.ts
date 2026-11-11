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
 const schema=u.searchParams.get('schema')??'1';
 if(view==='card'&&!['1','2'].includes(schema))return csResponse({error:{code:'bad_request',message:'Неизвестная схема карточки'}},400);
 const legacy=view==='card'&&schema==='1';
 // No fabricated sunset: the deadline starts at the first public client release.
 const sunset=process.env.CS_MORPHEME_SCHEMA1_SUNSET;
 if(sunset&&!Number.isFinite(Date.parse(sunset)))return csResponse({error:{code:'unavailable',message:'Морфемная база временно недоступна'}},503);
 if(legacy&&sunset&&Date.now()>=Date.parse(sunset))return csResponse({error:{code:'schema_retired',message:'Старая карточка снята с поддержки. Обновите приложение.'}},410);
 const compatibility:Record<string,string>=legacy?{'X-Morpheme-Schema-Deprecated':'true','Link':'<'+u.pathname+'?version='+encodeURIComponent(version??'')+'&schema=2>; rel="successor-version"',...(sunset?{'Sunset':new Date(sunset).toUTCString()}:{}),'Access-Control-Expose-Headers':'ETag, X-Morpheme-Schema-Deprecated, Sunset, Link'}:{};
 const size=u.searchParams.get('limit')??'20';
 if(view!=='word'&&!version)return csResponse({error:{code:'bad_request',message:'Укажите версию базы'}},400);
 if(view==='words'&&(!/^[1-9][0-9]*$/.test(size)||Number(size)>100))return csResponse({error:{code:'bad_request',message:'Размер страницы должен быть от 1 до 100'}},400);
 let p:ReturnType<typeof morphemePublication>|undefined;
 try{
  p=morphemePublication(view==='word'?undefined:version!);
  if(view==='word'&&p.dictionaryVersion!==dictionaryPublication().version)throw Error('Dictionary version mismatch');
  const body=view==='word'?p.word(id):view==='card'?p.card(id,Number(schema) as 1|2):p.words(id,Number(size),u.searchParams.get('cursor'));
  if(!body)return csResponse({error:{code:'not_found',message:'Материал не найден'}},404);
  const etag=p.etag(u.href);
  if(request.headers.get('If-None-Match')===etag)return new Response(null,{status:304,headers:{'Access-Control-Allow-Origin':'*','ETag':etag,'Cache-Control':'public, max-age=60',...compatibility}});
  return csResponse(body,200,{'ETag':etag,...compatibility});
 }catch(error){
  return error instanceof MorphemeError?csResponse({error:{code:error.code,message:error.message}},error.status):csResponse({error:{code:'unavailable',message:'Морфемная база временно недоступна'}},503);
 }finally{
  // Retained publications are request-scoped. The active publication stays cached.
  if(p&&view!=='word'&&p.db.name!==process.env.CS_MORPHEME_DB)p.db.close();
 }
}

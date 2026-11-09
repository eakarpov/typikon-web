import {authorizeUser} from '@/lib/api/v2/user';
import {respondPrivate,fail,preflight} from '@/lib/api/v2/http';
import {noteForOwner,sharing} from '@/lib/notes/sharing';
export const dynamic='force-dynamic';
export const OPTIONS=()=>{const r=preflight();r.headers.set('Access-Control-Allow-Methods','GET,POST,OPTIONS');return r;};
export async function GET(req:Request) {
  const a=await authorizeUser(req,'texts');if(a.denied)return a.denied;
  try {const id=new URL(req.url).searchParams.get('id')??'',n=await noteForOwner(a.userId,id);
    if(!n)return fail('not_found','Заметка не найдена.');
    return respondPrivate({userId:a.userId,id,revision:n.sharingRevision??0,noteRevision:n.revision??0,published:!!n.shareToken,shareToken:n.shareToken??null,preview:{text:String(n.note??''),quote:String(n.originalQuote??n.selection?.phrase??'')}},{access:a});
  }catch{return fail('bad_request','Не удалось получить настройки заметки.');}
}
export async function POST(req:Request) {
  const a=await authorizeUser(req,'texts');if(a.denied)return a.denied;
  try {const raw=await req.text();if(raw.length>2000)return fail('bad_request','Слишком большой запрос.');const b=JSON.parse(raw);
    if(!b||b.expectedUserId!==a.userId)return fail('conflict','Вход изменился.');
    return respondPrivate({userId:a.userId,...await sharing(a.userId,b)},{access:a});
  }catch(e){const m=(e as Error).message;return fail(m==='conflict'?'conflict':m==='not_found'?'not_found':e instanceof SyntaxError||m.startsWith('Неверн')?'bad_request':'internal',m==='conflict'?'Заметка изменилась. Обновите её перед публикацией.':m==='not_found'?'Заметка не найдена.':'Не удалось изменить доступ.');}
}

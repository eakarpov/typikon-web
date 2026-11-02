import {authorize} from '@/lib/api/v2/access';
import {respondPrivate,fail,preflight} from '@/lib/api/v2/http';
export const dynamic='force-dynamic';
export const OPTIONS=()=>{const r=preflight();r.headers.set('Access-Control-Allow-Methods','GET,POST,OPTIONS');return r;};
import {authorizeUser} from '@/lib/api/v2/user';
import {readProgress,writeProgress} from '@/lib/companion/progressService';
export async function GET(req:Request){const a=await authorizeUser(req,'texts');if(a.denied)return a.denied;try{return respondPrivate({userId:a.userId,state:await readProgress(a.userId)},{access:a});}catch{return fail('internal','Сохранения временно недоступны.');}}
export async function POST(req:Request){const a=await authorizeUser(req,'texts');if(a.denied)return a.denied;try{const text=await req.text();if(text.length>60000)return fail('bad_request','Слишком большой запрос.');const b=JSON.parse(text);if(b.expectedUserId!==a.userId)return fail('conflict','Вход изменился. Откройте Спутник заново.');return respondPrivate({userId:a.userId,state:await writeProgress(a.userId,b)},{access:a});}catch(e){const message=(e as Error).message;if(message==='conflict')return fail('conflict','Сохранения изменились на другом устройстве.');if(e instanceof SyntaxError)return fail('bad_request','Неверный JSON.');if(/^(Неверн|Сохранено|Выберите|Укажите)/.test(message))return fail('bad_request',message);return fail('internal','Не удалось сохранить изменения. Локальные данные остаются на устройстве.');}}

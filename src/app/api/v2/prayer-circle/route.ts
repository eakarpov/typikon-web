import { authorizeUser } from '@/lib/api/v2/user';
import { respondPrivate, fail, preflight } from '@/lib/api/v2/http';
import { readCircle, writeCircle } from '@/lib/prayerCircle/service';
import { CircleError } from '@/lib/prayerCircle/core';
import { reportError } from '@/lib/reportError';
export const dynamic='force-dynamic';
export const OPTIONS=()=>preflight();
export async function GET(req:Request) {
    const a=await authorizeUser(req,'texts');if(a.denied)return a.denied;
    try{return respondPrivate({userId:a.userId,state:await readCircle(a.userId,new URL(req.url).searchParams.get('cycle')??undefined)},{access:a});}
    catch(e){return error(e);}
}
async function write(req:Request,create:boolean) {
    const a=await authorizeUser(req,'texts');if(a.denied)return a.denied;
    try{
        const text=await req.text();if(text.length>90000)return fail('bad_request','Слишком большой запрос.');
        const input=JSON.parse(text);
        if(input?.expectedUserId!==a.userId)return fail('conflict','Вход изменился. Откройте круг заново.');
        return respondPrivate({userId:a.userId,state:await writeCircle(a.userId,input,create)},{access:a});
    }catch(e){return error(e);}
}
export const POST=(r:Request)=>write(r,true);
export const PATCH=(r:Request)=>write(r,false);
function error(e:unknown) {
    if(e instanceof CircleError)return fail(e.status===409?'conflict':e.status===404?'not_found':'bad_request',e.message);
    if(e instanceof SyntaxError)return fail('bad_request','Неверный JSON.');
    reportError(e,{where:'prayer-circle'});return fail('internal','Не удалось сохранить круг.');
}

import { authorize } from '@/lib/api/v2/access';
import { respondPrivate,fail,preflight } from '@/lib/api/v2/http';
import { getSession } from '@/lib/authorize/sessions';
import { previewCircle } from '@/lib/prayerCircle/service';
import { CircleError } from '@/lib/prayerCircle/core';
import { reportError } from '@/lib/reportError';
export const dynamic='force-dynamic';
export const OPTIONS=()=>preflight();
export async function POST(req:Request) {
    const a=await authorize(req,'texts');if(a.denied)return a.denied;
    try {
        const text=await req.text();if(text.length>90000)return fail('bad_request','Слишком большой запрос.');
        const session=await getSession();
        const input=JSON.parse(text);
        if(!input||typeof input!=='object'||Array.isArray(input))return fail('bad_request','Ожидается состав круга.');
        if('expectedUserId' in input && input.expectedUserId!==(session?.id??null))return fail('conflict','Вход изменился. Откройте круг заново.');
        return respondPrivate(await previewCircle(input,input.expectedUserId?session?.id:undefined),{access:a});
    }catch(e){if(e instanceof CircleError)return fail('bad_request',e.message);if(e instanceof SyntaxError)return fail('bad_request','Неверный JSON.');reportError(e,{where:'prayer-circle/preview'});return fail('internal','Не удалось собрать круг.');}
}

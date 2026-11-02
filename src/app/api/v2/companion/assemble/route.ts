import {authorize} from '@/lib/api/v2/access';
import {respondPrivate,fail,preflight} from '@/lib/api/v2/http';
export const dynamic='force-dynamic';
export const OPTIONS=()=>{const r=preflight();r.headers.set('Access-Control-Allow-Methods','GET,POST,OPTIONS');return r;};
import {assemble} from '@/lib/companion/server';
import {validateSelection} from '@/lib/companion/core';
export async function POST(req:Request){const a=await authorize(req,'ordo');if(a.denied)return a.denied;try{const raw=await req.text();if(raw.length>4000)return fail('bad_request','Слишком большой запрос.');let selection;try{selection=validateSelection(JSON.parse(raw));}catch(e){return fail('bad_request',(e as Error).message);}return respondPrivate(await assemble(selection),{access:a});}catch(e){return fail('ordo_unavailable',(e as Error).message);}}

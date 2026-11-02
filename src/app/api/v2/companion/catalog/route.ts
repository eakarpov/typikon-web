import {authorize} from '@/lib/api/v2/access';
import {respondPrivate,fail,preflight} from '@/lib/api/v2/http';
export const dynamic='force-dynamic';
export const OPTIONS=()=>{const r=preflight();r.headers.set('Access-Control-Allow-Methods','GET,POST,OPTIONS');return r;};
import {getCatalog} from '@/lib/companion/server';
export async function GET(req:Request){const a=await authorize(req,'ordo');if(a.denied)return a.denied;try{return respondPrivate(await getCatalog(),{access:a});}catch{return fail('ordo_unavailable','Каталог Спутника недоступен.');}}

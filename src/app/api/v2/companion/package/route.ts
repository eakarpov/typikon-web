import {authorize} from '@/lib/api/v2/access';
import {respondPrivate,fail,preflight} from '@/lib/api/v2/http';
export const dynamic='force-dynamic';
export const OPTIONS=()=>{const r=preflight();r.headers.set('Access-Control-Allow-Methods','GET,POST,OPTIONS');return r;};
import {compiler} from '@/lib/companion/server';
import {unzipSync,zipSync,strToU8} from 'fflate';
import {createHash} from 'node:crypto';
import {resolveScripture} from '@/lib/companion/scripture';
import {validateSelection} from '@/lib/companion/core';
export async function GET(req:Request){const a=await authorize(req,'ordo');if(a.denied)return a.denied;try{const selection=validateSelection(Object.fromEntries(new URL(req.url).searchParams));const r=await compiler('package',selection);const files=unzipSync(new Uint8Array(await r.arrayBuffer()));const bundle=await resolveScripture(JSON.parse(new TextDecoder().decode(files['companion.json'])));files['companion.json']=strToU8(JSON.stringify(bundle));const manifest=JSON.parse(new TextDecoder().decode(files['manifest.json']));for(const p of manifest.parts)if(p.path==='companion.json')p.sha256=createHash('sha256').update(files['companion.json']).digest('hex');files['manifest.json']=strToU8(JSON.stringify(manifest));const zipped=zipSync({...files,mimetype:[files.mimetype,{level:0}]});return new Response(zipped,{headers:{...a.headers,'Content-Type':'application/vnd.ordo+zip','Content-Disposition':'attachment; filename="companion.ordo"','Cache-Control':'private,no-store','Access-Control-Allow-Origin':'*'}});}catch(e){return fail('bad_request',(e as Error).message);}}

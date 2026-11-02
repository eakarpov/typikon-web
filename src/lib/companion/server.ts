import 'server-only';
import {resolveScripture} from './scripture';
import {validateSelection,type Selection,type Bundle,type Catalog} from './core';
export async function compiler(path:string,selection?:Selection):Promise<Response>{
 const base=process.env.ORDO_SERVICE_URL;if(!base)throw Error('Сборщик не настроен.');
 const url=new URL('/companion/'+path,base);if(selection)for(const [k,v] of Object.entries(validateSelection(selection)))if(v)url.searchParams.set(k,v);
 const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(120000)});if(!r.ok){let message='Сборщик временно недоступен.';try{message=(await r.json()).error??message;}catch{}throw Error(message);}return r;
}
export async function getCatalog():Promise<Catalog>{return (await compiler('catalog')).json();}
export async function assemble(selection:Selection):Promise<Bundle>{return resolveScripture(await (await compiler('assemble',selection)).json());}

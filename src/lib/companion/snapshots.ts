import type {Bundle,Selection} from './core';
export interface Snapshot {selection:Selection;bundle:Bundle}
const prefix='companion-snapshots:';
const storage=(owner:string)=>caches.open(prefix+owner);
const url=(owner:string,key:string)=>new URL('/__companion-snapshot/'+encodeURIComponent(owner)+'/'+encodeURIComponent(key),location.origin).href;
export async function snapshot(owner:string,key:string):Promise<Snapshot|null>{
 if(typeof caches==='undefined')return JSON.parse(localStorage.getItem('companion:'+owner+':snapshot:'+key)??'null');
 const r=await(await storage(owner)).match(url(owner,key));return r?await r.json():null;
}
export async function putSnapshot(owner:string,key:string,value:Snapshot){
 if(typeof caches==='undefined'){localStorage.setItem('companion:'+owner+':snapshot:'+key,JSON.stringify(value));return;}
 await(await storage(owner)).put(url(owner,key),new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json','Cache-Control':'private,no-store'}}));
}
export async function removeSnapshot(owner:string,key:string){
 localStorage.removeItem('companion:'+owner+':snapshot:'+key);if(typeof caches!=='undefined')await(await storage(owner)).delete(url(owner,key));
}
export async function snapshots(owner:string):Promise<Snapshot[]>{
 if(typeof caches==='undefined')return Object.keys(localStorage).filter(k=>k.startsWith('companion:'+owner+':snapshot:')).flatMap(k=>{try{return [JSON.parse(localStorage.getItem(k)!)];}catch{return [];}});
 const cache=await storage(owner);return Promise.all((await cache.keys()).map(async request=>(await(await cache.match(request))!.json()) as Snapshot));
}
export async function clearPrivateSnapshots(){if(typeof caches!=='undefined')await Promise.all((await caches.keys()).filter(k=>k.startsWith(prefix+'user:')).map(k=>caches.delete(k)));}

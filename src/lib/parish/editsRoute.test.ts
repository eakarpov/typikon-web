import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);

test('API сохраняет состав одной утренней литургии 15 ноября',async()=>{
 const bundle=await build({stdin:{contents:`
 exports.POST=require('./src/app/api/parish/[slug]/edits/route.ts').POST;
 exports.saved=require('@/lib/parish/edits').saved;
 `,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'cjs',write:false,external:['next/server'],plugins:[{name:'storage',setup(b){
  b.onResolve({filter:/^@\/lib\/parish\/(access|edits)$|^@\/lib\/memories$/},args=>({path:args.path,namespace:'test'}));
  b.onLoad({filter:/.*/,namespace:'test'},args=>({contents:args.path.endsWith('/access')
   ?'exports.rightsOn=async()=>({canEdit:true,userId:"editor"});exports.touchAdmin=async()=>{};'
   :args.path.endsWith('/edits')
   ?'exports.saved=[];exports.saveEdit=async edit=>{exports.saved.push(edit);return "saved-edit";};exports.dropEdit=async()=>{};'
   :'exports.getMemory=async()=>{throw Error("No memory lookup expected");};'}));
 }}]});
 const holder={exports:{}};
 new Function('require','module','exports',bundle.outputFiles![0].text)(require,holder,holder.exports);
 const api=holder.exports as {POST:(request:Request,ctx:{params:Promise<{slug:string}>})=>Promise<Response>;saved:Array<{value:{services:string[]};date:string;op:string;gatheringKey:string}>};
 const gatheringKey='2026-11-15:utro:hour-3-hour-6-hour-9-izobrazitelny-liturgy';
 const response=await api.POST(new Request('https://www.typikon.info/api/parish/temple/edits',{
  method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({month:'2026-11',date:'2026-11-15',part:'utro',gatheringKey,op:'compose',value:{services:['hour-3','hour-6','liturgy-chrysostom'],time:'09:30',part:'utro',details:{}},baseline:{}})
 }),{params:Promise.resolve({slug:'temple'})});
 assert.equal(response.status,200);assert.deepEqual(await response.json(),{id:'saved-edit'});
 assert.equal(api.saved.length,1);assert.equal(api.saved[0].date,'2026-11-15');assert.equal(api.saved[0].op,'compose');assert.equal(api.saved[0].gatheringKey,gatheringKey);
 assert.deepEqual(api.saved[0].value.services,['hour-3','hour-6','liturgy-chrysostom']);
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requestQueue} from './ordoQueue';
import {cacheComplete} from './completeCache';
import {ordoDay} from './ordo';
test('два параллельных слота на все страницы, одинаковый запрос не дублируется',async()=>{
 const queue=requestQueue(2);let active=0,peak=0,calls=0;
 const tasks=Array.from({length:24},(_,i)=>queue.run(String(i%12),async()=>{calls++;active++;peak=Math.max(active,peak);await new Promise(r=>setTimeout(r,2));active--;return i%12;}));
 const results=await Promise.all(tasks);assert.equal(peak,2);assert.equal(calls,12);assert.equal(results.length,24);
 await assert.rejects(queue.run('failure',async()=>{throw Error('failure');}));assert.equal(await queue.run('failure',async()=>42),42);
});
test('временный пустой календарь не сохраняется, следующий запрос восстанавливает расписание',async()=>{
 let calls=0,memo:unknown;
 const read=cacheComplete(async()=>({days:++calls===1?[]:['2026-11-12']}),work=>async()=>{if(memo)return memo as {days:string[]};const value=await work();memo=value;return value;},value=>!!value.days.length);
 assert.deepEqual((await read()).days,[]);assert.deepEqual((await read()).days,['2026-11-12']);await read();assert.equal(calls,2);
 const fail=cacheComplete(async()=>{throw Error('database failure');},f=>f,()=>true);await assert.rejects(fail(),/database failure/);
});
test('503 от занятого движка повторяется и возвращает день после освобождения слота',async()=>{
 const originalFetch=globalThis.fetch,originalUrl=process.env.ORDO_SERVICE_URL;let calls=0;
 process.env.ORDO_SERVICE_URL='http://retry.test';
 globalThis.fetch=async()=>++calls===1?Response.json({error:'busy'},{status:503,headers:{'Retry-After':'0'}}):Response.json({day:{date:'2026-11-12',memories:[],variants:[]}});
 try{assert.equal((await ordoDay('2026-11-12'))?.date,'2026-11-12');assert.equal(calls,2);}
 finally{globalThis.fetch=originalFetch;if(originalUrl===undefined)delete process.env.ORDO_SERVICE_URL;else process.env.ORDO_SERVICE_URL=originalUrl;}
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {zipSync,strToU8} from 'fflate';
import {ordoDay} from '../ordo';
import {ordoDayPackage} from '../ordoPackage';
test('шапка дня и пакет последования получают одинаковый выбранный состав, знак и престолы',async()=>{
 const originalFetch=globalThis.fetch,originalUrl=process.env.ORDO_SERVICE_URL;
 const seen:URL[]=[];
 const bytes=zipSync(Object.fromEntries(Object.entries({
  'manifest.json':{format:'posledovanie',spec_version:'1.1',scope:{date:'2026-11-12',variant:'declared',services:['vespers']}},
  'ordo.json':{date:'2026-11-12'},
  'services/vespers.json':{key:'vespers',label:'Великая вечерня',civil:'2026-11-11',part:'vecher',steps:[]},
  'addresses.json':{spec:'1.1',lines:[],memories:{}},
 }).map(([key,value])=>[key,strToU8(JSON.stringify(value))])));
 process.env.ORDO_SERVICE_URL='http://ordo.test';
 globalThis.fetch=async(input)=>{
  const url=new URL(String(input));seen.push(url);
  return url.pathname==='/day'?Response.json({day:{date:'2026-11-12',variants:[],memories:[]}}):new Response(bytes as unknown as BodyInit);
 };
 try{
  const opts={ustav:'jerusalem/rus-synodal',memories:['saint-a','saint-b'],serviceSign:'polieley',prestoly:[{memoryId:'temple',kind:'svyatogo',label:'Святой'}]};
  assert.equal((await ordoDay('2026-11-12',opts))?.date,'2026-11-12');
  const pkg=await ordoDayPackage({date:'2026-11-12',variant:'declared',...opts});
  assert.equal(pkg.error,null);assert.equal(pkg.data?.services.length,1);
  assert.equal(seen.length,2);
  for(const url of seen){assert.deepEqual(url.searchParams.getAll('memories'),opts.memories);assert.equal(url.searchParams.get('service_sign'),'polieley');assert.equal(url.searchParams.get('prestoly'),'temple|svyatogo|Святой');assert.equal(url.searchParams.get('ustav'),opts.ustav);}
 }finally{globalThis.fetch=originalFetch;if(originalUrl===undefined)delete process.env.ORDO_SERVICE_URL;else process.env.ORDO_SERVICE_URL=originalUrl;}
});

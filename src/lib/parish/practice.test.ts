import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyPractice,defaultPractice,practiceTime,slots,validatePractice,PRACTICE_RULES} from './practice';
import {parseCivilYear,parseCivilSource,civilYear} from './civilCalendar';
import {validateDayConfig} from './dayConfig';
import type {ParishDay,Gathering} from './types';
const service=(key:string,label=key)=>({key,label});
const gathering=(key:string,part:Gathering['part'],services:Gathering['services']):Gathering=>({key,civil:'2026-11-13',part,partLabel:part,time:null,title:services.map(s=>s.label).join('. '),belongsTo:null,duration:null,services,why:[]});
const day=(date:string,gatherings:Gathering[]=[]):ParishDay=>({date,weekdayLabel:'',label:'Полиелей, седмичный день',sign:'polieley',triodLabel:null,memories:[],fastingLabel:'Пост',prestolny:null,dvunadesyaty:false,tone:1,gatherings});
const liturgy=gathering('l','utro',[service('hour-3','3-й час'),service('liturgy','Литургия')]);
test('две литургии — ранняя и обычная; разовый выбор дня выше постоянного',()=>{
 const p=defaultPractice('RU');p.compline='never';p.liturgies.sunday=3;
 p.times.sundayEarly.morning='06:00';p.times.sundayOrdinary.morning='08:30';p.times.sundayLate.morning='11:00';
 assert.deepEqual(slots(1),['ordinary']);assert.deepEqual(slots(2),['early','ordinary']);
 const sunday=day('2026-11-15',[liturgy]);
 assert.deepEqual(applyPractice([sunday],p)[0].gatherings.map(g=>g.time),['06:00','08:30','11:00']);
 sunday.dayConfig={date:sunday.date,memories:[],sign:null,morningLiturgies:2};
 const changed=applyPractice([sunday],p)[0];assert.deepEqual(changed.gatherings.map(g=>g.liturgySlot),['early','ordinary']);assert.equal(changed.defaultMorningLiturgies,3);
 sunday.dayConfig.morningLiturgies=1;assert.equal(applyPractice([sunday],p)[0].gatherings[0].key,'l');
 assert.deepEqual(sunday.gatherings[0],liturgy,'исходное расписание не мутирует');
});
test('воскресенье имеет свои часы, выходной по стране применяется к будням, суббота может переопределять базу',()=>{
 const p=defaultPractice('RU');p.times.weekday.morning='08:00';p.times.weekend.morning='09:00';p.times.sundayOrdinary.morning='10:00';
 const monday=day('2026-11-16');assert.equal(practiceTime(monday,p,'morning'),'08:00');monday.civilDayOff=true;assert.equal(practiceTime(monday,p,'morning'),'09:00');
 const saturday=day('2026-11-14');assert.equal(practiceTime(saturday,p,'morning'),'09:00');saturday.civilDayOff=false;assert.equal(practiceTime(saturday,p,'morning'),'08:00');p.times.saturday.morning='07:00';assert.equal(practiceTime(saturday,p,'morning'),'07:00');
 const sunday=day('2026-11-15');sunday.civilDayOff=false;assert.equal(practiceTime(sunday,p,'morning'),'10:00');
});
test('престол выше великого праздника и воскресенья, отдельный час имеет приоритет',()=>{
 const p=defaultPractice('RU');p.compline='never';p.liturgies.sunday=1;p.liturgies.feast=2;p.liturgies.patron=3;
 const d=day('2026-11-15',[liturgy]);d.dvunadesyaty=true;
 assert.equal(applyPractice([d],p)[0].gatherings.length,2);d.prestolny='Храмовый святой';assert.equal(applyPractice([d],p)[0].gatherings.length,3);
 p.times.patronOrdinary.morning='10:20';assert.equal(practiceTime(d,p,'morning'),'10:20');
});
test('повечерие и полунощница: всегда, только постом или нет',()=>{
 const p=defaultPractice('RU');p.compline='always';p.midnight='lent';
 let d=day('2026-11-13');assert.deepEqual(applyPractice([d],p)[0].gatherings.flatMap(g=>g.services.map(s=>s.key)),['compline']);
 d.liturgicalSeason='velikiy-post';assert.deepEqual(new Set(applyPractice([d],p)[0].gatherings.flatMap(g=>g.services.map(s=>s.key))),new Set(['compline-great','midnight']));
 p.compline='never';p.midnight='never';assert.equal(applyPractice([d],p)[0].gatherings.length,0);
 assert.ok(PRACTICE_RULES.every(r=>!JSON.stringify(r).includes('strastnaya')&&!JSON.stringify(r).includes('paskha')));
});
test('панихида после вечерни отличается от панихиды в конце вечерней службы',()=>{
 const p=defaultPractice('RU');p.compline='never';const friday=day('2026-11-13',[gathering('v','vecher',[service('vespers'),service('matins')])]);
 p.panihida='friday-vespers';assert.deepEqual(applyPractice([friday],p)[0].gatherings[0].services.map(s=>s.key),['vespers','panihida','matins']);
 p.panihida='friday-end';assert.deepEqual(applyPractice([friday],p)[0].gatherings[0].services.map(s=>s.key),['vespers','matins','panihida']);
 p.panihida='saturday-liturgy';assert.equal(applyPractice([day('2026-11-14')],p)[0].gatherings.length,0);
 const saturday=applyPractice([day('2026-11-14',[liturgy])],p)[0];assert.equal(saturday.gatherings[0].services.at(-1)?.key,'panihida');
});
test('валидируются время, количество литургий и разовый выбор, настройки не теряют скрытые часы',()=>{
 const p=defaultPractice('RU');p.times.sundayLate.morning='11:45';assert.deepEqual(validatePractice(p),p);
 assert.throws(()=>validatePractice({...p,liturgies:{...p.liturgies,sunday:4}}));assert.throws(()=>validatePractice({...p,times:{...p.times,weekday:{morning:'25:00',evening:'18:00'}}}));
 assert.equal(validateDayConfig({date:'2026-11-15',memories:[],sign:null,morningLiturgies:3}).morningLiturgies,3);
 assert.throws(()=>validateDayConfig({date:'2026-11-15',memories:[],sign:null,morningLiturgies:0}));
});
test('производственный календарь: переносы, сокращённые рабочие дни, високосный год, отказ API',async()=>{
 const body='1'+'2'+'4'+'0'.repeat(363),calendar=parseCivilYear(2024,body);assert.equal(Object.keys(calendar).length,366);assert.equal(calendar['2024-01-01'],true);assert.equal(calendar['2024-01-02'],false);assert.equal(calendar['2024-01-03'],false);assert.throws(()=>parseCivilYear(2026,'100'));
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;return new Response('0'.repeat(365));};
 try{const values=await Promise.all([civilYear('RU',2026),civilYear('RU',2026)]);assert.equal(calls,1);assert.equal(Object.keys(values[0]!).length,365);await civilYear('RU',2026);assert.equal(calls,1);
 globalThis.fetch=async()=>{calls++;throw Error('network');};assert.equal(await civilYear('BY',2026),null);assert.equal(await civilYear('BY',2026),null);assert.equal(calls,3);
 }finally{globalThis.fetch=original;}
});

test('официальный резервный календарь применяется при отказе API и учитывает рабочую субботу',async()=>{
 const source={year:2026,countrycode:'kz',dayoff:['0101','0316'],workday:['0314'],predayoff:['0425'],covidday:[]};
 const parsed=parseCivilSource('KZ',2026,source);
 assert.equal(parsed['2026-03-14'],false);assert.equal(parsed['2026-03-15'],true);assert.equal(parsed['2026-04-25'],false);assert.equal(parsed['2026-03-16'],true);assert.equal(Object.keys(parsed).length,365);
 assert.throws(()=>parseCivilSource('RU',2026,source));assert.throws(()=>parseCivilSource('KZ',2026,{...source,dayoff:['0230']}));
 const original=globalThis.fetch,urls:string[]=[];
 globalThis.fetch=async url=>{urls.push(String(url));if(String(url).startsWith('https://isdayoff.ru'))throw Error('timeout');return Response.json(source);};
 try{const calendar=await civilYear('KZ',2026);assert.equal(calendar?.['2026-03-14'],false);assert.equal(calendar?.['2026-03-16'],true);assert.equal(urls.length,2);assert.match(urls[1],/isdayoff\/calendars\/main\/db\/2026\/kz2026.json/);}finally{globalThis.fetch=original;}
});
test('серверный адрес календаря можно направить через мост, страна и год передаются отдельно',async()=>{
 const original=globalThis.fetch,old=process.env.CIVIL_CALENDAR_URL;let asked:URL|undefined;
 process.env.CIVIL_CALENDAR_URL='https://bridge.test/_internal/civil-calendar';
 globalThis.fetch=async url=>{asked=new URL(String(url));return new Response('0'.repeat(365));};
 try{assert.ok(await civilYear('UZ',2026));assert.equal(asked?.host,'bridge.test');assert.equal(asked?.pathname,'/_internal/civil-calendar');assert.equal(asked?.searchParams.get('cc'),'uz');assert.equal(asked?.searchParams.get('year'),'2026');}
 finally{globalThis.fetch=original;if(old===undefined)delete process.env.CIVIL_CALENDAR_URL;else process.env.CIVIL_CALENDAR_URL=old;}
});

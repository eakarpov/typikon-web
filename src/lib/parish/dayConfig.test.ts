import {test} from 'node:test';
import assert from 'node:assert/strict';
import {serviceLabel,composedServices,serviceSelection,validateDayConfig,dayOrdoHref} from './dayConfig';
import {applyEdits,type ParishEdit} from './editModel';
import type {ParishDay,Gathering} from './types';
import {buildMonth} from './gatherings';
import type {OrdoDay} from '../ordo';
const gathering:Gathering={key:'g',civil:'2026-11-12',part:'vecher',partLabel:'вечером',time:'17:00',title:'Вечерня',belongsTo:'Святой завтра',duration:null,services:[{key:'vespers',label:'Вечерня'}],why:[],serviceSign:'polieley'};
const day:ParishDay={date:'2026-11-12',weekdayLabel:'четверг',label:'День',sign:'bez-znaka',eveningSign:'polieley',triodLabel:null,memories:[],fastingLabel:null,prestolny:null,dvunadesyaty:false,tone:1,gatherings:[gathering]};
const edit=(op:ParishEdit['op'],value:ParishEdit['value'],part:ParishEdit['part']='utro',key='g'):ParishEdit=>({parishSlug:'temple',month:'2026-W46',date:day.date,part,gatheringKey:key,op,value,baseline:{},createdAt:new Date()});
test('подписи вечерни и утрени зависят от знака, бдение без уточнений',()=>{
 assert.equal(serviceLabel('vespers','polieley'),'Великая вечерня');
 assert.equal(serviceLabel('vespers','slavoslovie'),'Вседневная вечерня');
 assert.equal(serviceLabel('matins','bez-znaka'),'Вседневная утреня');
 assert.equal(serviceLabel('matins','slavoslovie'),'Утреня со славословием');
 assert.equal(serviceLabel('matins','polieley'),'Утреня с полиелеем');
 assert.equal(serviceLabel('vsenoshchnoe','bdenie'),'Всенощное бдение');
 assert.deepEqual(composedServices(['vespers','matins','vsenoshchnoe'],'bdenie').map(s=>s.label),['Всенощное бдение']);
});
test('полунощница, повечерие, отдельные часы и все три литургии доступны',()=>{
 for(const key of ['midnight','compline','hour-1','hour-3','hour-6','hour-9'])assert.notEqual(serviceLabel(key,'bez-znaka'),key);
 assert.match(serviceLabel('liturgy-basil','bez-znaka'),/\(!\)/);assert.match(serviceLabel('liturgy-presanctified','bez-znaka'),/\(!\)/);
 assert.doesNotMatch(serviceLabel('liturgy-chrysostom','bez-znaka'),/!/);
 assert.deepEqual(serviceSelection(['liturgy-basil'],'liturgy-chrysostom',true),['liturgy-chrysostom']);
 assert.deepEqual(serviceSelection(['vespers','matins'],'vsenoshchnoe',true),['vsenoshchnoe']);
});
test('молебен утром и панихида вечером добавляются независимо, часы имеют разные времена',()=>{
 const result=applyEdits([day],[edit('add',{services:['moleben'],time:'08:00'},'utro','m'),edit('add',{services:['panihida'],time:'18:00'},'vecher','p'),edit('add',{services:['hour-1'],time:'06:00'},'utro','h1'),edit('add',{services:['hour-3'],time:'08:30'},'utro','h3')]).days[0];
 assert.equal(result.gatherings.find(g=>g.key==='m')?.part,'utro');assert.equal(result.gatherings.find(g=>g.key==='p')?.part,'vecher');
 assert.deepEqual(result.gatherings.filter(g=>g.key.startsWith('h')).map(g=>[g.title,g.time]),[['1-й час','06:00'],['3-й час','08:30']]);
});
test('изменение состава сохраняет связь вечерни со следующим церковным днём',()=>{
 const result=applyEdits([day],[edit('compose',{services:['vespers','matins'],time:'18:00',part:'vecher'})]).days[0].gatherings[0];
 assert.equal(result.title,'Великая вечерня. Утреня с полиелеем');assert.equal(result.belongsTo,'Святой завтра');assert.equal(result.time,'18:00');
 const added=applyEdits([day],[edit('add',{services:['vespers']},'vecher','new')]).days[0].gatherings.find(g=>g.key==='new');assert.equal(added?.title,'Великая вечерня');
});
test('ссылка последования сохраняет состав, знак, устав и престолы выбранного дня',()=>{
 const href=dayOrdoHref({...day,serviceMemories:['saint-a','saint-b'],serviceSign:'polieley',serviceVariant:'declared',servicePrestoly:[{memoryId:'temple-saint',kind:'svyatogo',label:'Святой'}]},'jerusalem/rus-synodal');
 const q=new URL(href,'http://localhost').searchParams;
 assert.deepEqual(q.getAll('memories'),['saint-a','saint-b']);assert.equal(q.get('service_sign'),'polieley');assert.equal(q.get('variant'),'declared');assert.equal(q.get('date'),day.date);assert.equal(q.get('ustav'),'jerusalem/rus-synodal');assert.equal(q.get('prestoly'),'temple-saint|svyatogo|Святой');
 assert.throws(()=>validateDayConfig({date:day.date,memories:['a','a'],sign:null}));assert.throws(()=>validateDayConfig({date:day.date,memories:[],sign:'bad'}));
});
test('знак церковного дня определяет заголовок вечерни в предыдущей гражданской строке',()=>{
 const make=(date:string,sign:string,civil:string):OrdoDay=>({date,churchDate:{month:10,day:30},weekday:'chetverg',weekdayLabel:'четверг',paschaOffset:200,memories:[{memoryId:date,label:date,book:'menaion'}],variants:[{key:'declared',sign,dayVariant:'sedmichny',label:sign,feast:null,hram:null,stoyaniya:[{key:'v',civil,part:'vecher',partLabel:'вечером',why:[],services:[{key:'vespers',label:'Вечерня'}]}]}]} as unknown as OrdoDay);
 const rows=buildMonth(new Map([['2026-11-12',make('2026-11-12','bez-znaka','2026-11-11')],['2026-11-13',make('2026-11-13','polieley','2026-11-12')]]),{slug:'temple',title:'Храм',timezone:'Europe/Moscow',prestoly:[],rules:[]},d=>d==='2026-11-12');
 assert.equal(rows[0].gatherings[0].title,'Великая вечерня');assert.equal(rows[0].gatherings[0].serviceSign,'polieley');assert.equal(rows[0].gatherings[0].belongsTo,'2026-11-13');
});

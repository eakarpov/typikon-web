import {test} from 'node:test';
import assert from 'node:assert/strict';
import {restoreCancelled,type CancellationStore} from './restore';
import {applyEdits,type ParishEdit} from './editModel';
import type {ParishDay} from './types';
const date='2026-11-15';
const day:ParishDay={date,weekdayLabel:'воскресенье',label:'',sign:'polieley',triodLabel:null,memories:[],fastingLabel:null,prestolny:null,dvunadesyaty:false,tone:1,gatherings:[{key:'g',civil:date,part:'vecher',partLabel:'вечером',time:'17:00',title:'Вечерня',belongsTo:'Память завтра',duration:null,services:[{key:'vespers',label:'Вечерня'}],why:[]}]};
const entry=(op:ParishEdit['op'],value:ParishEdit['value']={},part:ParishEdit['part']='vecher'):ParishEdit=>({parishSlug:'temple',month:'2026-11',date,part,gatheringKey:'g',op,value,baseline:{},createdAt:new Date()});
function store(initial:ParishEdit[]){let items=initial;const collection:CancellationStore={async deleteMany(filter){const before=items.length;items=items.filter(item=>!Object.entries(filter).every(([key,value])=>item[key as keyof ParishEdit]===value));return {deletedCount:before-items.length};}};return {collection,items:()=>items};}
test('возврат снимает отмену после переноса, сохраняя время, состав и выбранные памяти',async()=>{
 const details={moleben:{memories:[{memoryId:'saint',label:'Святитель Николай'}],akathist:true}};
 const compose=entry('compose',{services:['moleben'],details,part:'utro'});
 const time=entry('time',{time:'08:20'},'utro');
 const data=store([entry('cancel'),compose,time,entry('cancel',{},'utro')]);
 const before=applyEdits([day],data.items()).days[0].gatherings[0];assert.equal(before.cancelled,true);
 assert.equal((await restoreCancelled(data.collection,'temple',date,'g')).deletedCount,2);
 const after=applyEdits([day],data.items()).days[0].gatherings[0];
 assert.equal(!!after.cancelled,false);assert.equal(after.part,'utro');assert.equal(after.time,'08:20');assert.deepEqual(after.details,details);assert.equal(after.title,'Молебен с акафистом — Святитель Николай');
 assert.deepEqual(data.items(),[compose,time]);
});
test('возврат работает для добавленной вручную службы и не затрагивает другой храм, дату или собрание',async()=>{
 const added=entry('add',{services:['compline-great'],details:{compline:{memories:[{memoryId:'s',label:'Святой'}]}},time:'18:00'});
 const other=[{...entry('cancel'),parishSlug:'other'},{...entry('cancel'),date:'2026-11-16'},{...entry('cancel'),gatheringKey:'another'}];
 const data=store([added,entry('cancel'),...other]);
 const empty={...day,gatherings:[]};assert.equal(applyEdits([empty],data.items().filter(e=>e.parishSlug==='temple')).days[0].gatherings[0].cancelled,true);
 await restoreCancelled(data.collection,'temple',date,'g');
 const restored=applyEdits([empty],data.items().filter(e=>e.parishSlug==='temple')).days[0].gatherings[0];assert.equal(!!restored.cancelled,false);assert.equal(restored.time,'18:00');assert.match(restored.title,/Великое повечерие — Святой/);assert.ok(data.items().includes(added));for(const item of other)assert.ok(data.items().includes(item));
 assert.equal((await restoreCancelled(data.collection,'temple',date,'g')).deletedCount,0,'повторный возврат безопасен');
});

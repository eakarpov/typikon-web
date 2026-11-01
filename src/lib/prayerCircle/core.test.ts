import { test } from 'node:test';
import assert from 'node:assert/strict';
import { availablePresets,presetVariant,applyOperation,initialConfig,createState,ensureCycle,cycleAt,blocksFor,compose,validateConfig,type Operation } from './core';
const now=new Date('2026-11-01T13:00:00Z');
function op(revision:number,action:Operation['action'],extra:Record<string,unknown>={},id='op-'+revision):Operation{return {id,revision,cycle:'2026-11-01',action,...extra};}
test('local 15:00 boundary and midnight preserve a cycle',()=>{
 assert.equal(cycleAt(new Date('2026-11-01T11:59:59Z'),'Europe/Moscow'),'2026-10-31');
 assert.equal(cycleAt(new Date('2026-11-01T12:00:00Z'),'Europe/Moscow'),'2026-11-01');
 assert.equal(cycleAt(new Date('2026-11-01T22:00:00Z'),'Europe/Moscow'),'2026-11-01');
});
test('evening and following morning use their own weekdays',()=>{
 const s=createState(initialConfig());const c=ensureCycle(s,'2026-11-01');c.config.variants[0].blocks[0].weekdays=[7];c.config.variants[0].blocks[1].weekdays=[1];assert.equal(blocksFor(c).length,3);
});
test('viewing future does not activate pending settings for today',()=>{
 let s=createState(initialConfig());ensureCycle(s,'2026-11-02');const c=initialConfig();c.variants[0].title='Изменённое';
 s=applyOperation(s,op(0,'config',{config:c}),now);
 assert.equal(ensureCycle(s,'2026-11-02').config.variants[0].title,'Изменённое');
 assert.equal(ensureCycle(s,'2026-11-01').config.variants[0].title,'Обычное правило');
 assert.equal(s.config.variants[0].title,'Обычное правило');
});
test('replayed and undone completion cannot advance the Psalter twice',()=>{
 const c=initialConfig();c.variants[0].blocks.push({id:'psalter',title:'Псалтирь',kind:'psalter',key:'psaltir',part:'morning',weekdays:[1,2,3,4,5,6,7],mode:'continuous',unit:'statia'});
 let s=createState(c);s=applyOperation(s,op(0,'mark',{blockId:'psalter',done:true}),now);
 assert.equal(s.cursors.psalter,1);assert.deepEqual(applyOperation(s,op(0,'mark',{blockId:'psalter',done:true}),now),s);
 s=applyOperation(s,op(1,'mark',{blockId:'psalter',done:false}),now);s=applyOperation(s,op(2,'mark',{blockId:'psalter',done:true}),now);assert.equal(s.cursors.psalter,1);
 assert.equal(ensureCycle(s,'2026-11-03').cursors.psalter,1);
});
test('schedule and continuous positions are independent',()=>{
 const c=initialConfig();c.variants[0].blocks.push({id:'psalter',title:'Псалтирь',kind:'psalter',key:'psaltir',part:'morning',weekdays:[1,2,3,4,5,6,7],mode:'scheduled',unit:'kathisma',schedule:{'1':[17]}});
 let s=createState(c);s.cursors.psalter=48;s=applyOperation(s,op(0,'mark',{blockId:'psalter',done:true}),now);assert.equal(s.cursors.psalter,48);
});
test('conflicting revisions are rejected without modifying the original',()=>{
 const s=createState(initialConfig());assert.throws(()=>applyOperation(s,op(1,'mark',{blockId:'morning_prayerbook',done:true}),now),/изменился/);assert.equal(s.revision,0);
});
test('structural insertion preserves intentional repeated words',()=>{
 const r=(id:string,zone:string)=>({id,zone,kind:'text',text:'Господи, помилуй'});
 assert.deepEqual(compose([r('body','body'),r('close','closing')],[r('start','opening'),r('canon','body'),r('end','closing')]).map(r=>r.id),['body','canon','close']);
});
test('reject impossible dates, duplicate occurrence IDs and malformed scheduling',()=>{
 const c=initialConfig();c.variants[0].blocks.push({...c.variants[0].blocks[0]});assert.throws(()=>validateConfig(c));
 const d=initialConfig();d.communion={date:'2026-02-30',days:3};assert.throws(()=>validateConfig(d));
 const e=initialConfig();e.timeZone='';assert.throws(()=>validateConfig(e));
});
test('forty snapshots retain a requested old cycle',()=>{
 const s=createState(initialConfig());for(let n=1;n<=28;n++)ensureCycle(s,`2026-10-${String(n).padStart(2,'0')}`);
 for(let n=1;n<=20;n++)ensureCycle(s,`2026-11-${String(n).padStart(2,'0')}`);
 assert.ok(ensureCycle(s,'2026-09-01'));assert.ok(Object.keys(s.cycles).length<=40);
});

test('preparation completion survives a new daily cycle',()=>{
 const c=initialConfig();c.communion={date:'2026-11-05',days:3};let s=createState(c);
 s=applyOperation(s,op(0,'communion-mark',{blockId:'canon:0',done:true}),now);
 assert.equal(ensureCycle(s,'2026-11-02').marks['communion:2026-11-05:canon:0'],true);
});

test('apply today keeps unchanged marks and clears marks for changed content',()=>{
 let s=createState(initialConfig());s=applyOperation(s,op(0,'mark',{blockId:'morning_prayerbook',done:true}),now);
 s=applyOperation(s,op(1,'mark',{blockId:'evening_prayerbook',done:true}),now);
 const config=structuredClone(s.config);config.variants[0].blocks[0].key='serafim';
 s=applyOperation(s,op(2,'config',{config,applyToday:true}),now);
 assert.equal(ensureCycle(s,'2026-11-01').marks.morning_prayerbook,true);
 assert.equal(ensureCycle(s,'2026-11-01').marks.evening_prayerbook,undefined);
});

test('a ready rule is selected atomically without changing the default, marks or pending composition',()=>{
 let s=createState(initialConfig());s=applyOperation(s,op(0,'mark',{blockId:'evening_prayerbook',done:true}),now);
 s=applyOperation(s,op(1,'config',{config:initialConfig()}),now);
 const template={id:'horologion',key:'horologion',title:'Правило по Часослову',status:'verified'};
 const select=op(2,'override',{part:'morning',templateId:template.id,template});s=applyOperation(s,select,now);
 assert.equal(s.config.activeId,'ordinary');assert.ok(s.pending);
 assert.equal(ensureCycle(s,'2026-11-01').marks.evening_prayerbook,true);
 assert.equal(blocksFor(ensureCycle(s,'2026-11-01')).find(b=>b.part==='morning')?.key,'horologion');
 assert.equal(blocksFor(ensureCycle(s,'2026-11-01')).find(b=>b.part==='evening')?.key,'na-son');
 assert.equal(applyOperation(s,select,now),s);
 s=applyOperation(s,op(3,'override',{part:'evening',templateId:template.id,template}),now);
 assert.equal(s.config.variants.filter(v=>v.basedOn==='horologion').length,1);
});
test('ready rules do not reuse an edited personal composition and unverified sources are rejected',()=>{
 const template={id:'horologion',key:'horologion',title:'Часослов',status:'verified'};
 const c=initialConfig();const v=presetVariant(template,'ready:horologion');v.blocks[0].key='serafimovo';c.variants.push(v);
 let s=createState(c);s=applyOperation(s,op(0,'override',{part:'morning',templateId:template.id,template}),now);
 assert.equal(s.config.variants[1].blocks[0].key,'serafimovo');
 assert.equal(blocksFor(ensureCycle(s,'2026-11-01')).find(b=>b.part==='morning')?.key,'horologion');
 assert.throws(()=>applyOperation(s,op(1,'override',{part:'morning',templateId:'old',template:{id:'old',key:'old',title:'1636',status:'needs_collation'}}),now));
});

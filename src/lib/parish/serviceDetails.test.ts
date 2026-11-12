import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateServiceDetails,resolveServiceDetails,detailsInput,detailServices,nextDayLabel,defaultHours,defaultHourServices,chooseService,normalizeHourText,normalizeHours,displayGatheringTitle} from './serviceDetails';
import {applyEdits,type ParishEdit} from './editModel';
import {applyPractice,defaultPractice,liturgySlotLabel,timeRowLabel} from './practice';
import {validateDayConfig,serviceSelection,serviceLabel} from './dayConfig';
import type {Gathering,ParishDay} from './types';
const group=(keys:string[]):Gathering=>({key:'g',civil:'2026-11-15',part:'vecher',partLabel:'вечером',time:'17:00',title:keys.map(k=>serviceLabel(k,'polieley')).join('. '),belongsTo:'Святой следующего дня',duration:null,services:keys.map(key=>({key,label:serviceLabel(key,'polieley')})),why:[]});
const day=(groups:Gathering[]):ParishDay=>({date:'2026-11-15',weekdayLabel:'воскресенье',label:'',sign:'polieley',eveningSign:'polieley',triodLabel:null,memories:[],fastingLabel:null,prestolny:null,dvunadesyaty:false,tone:1,gatherings:groups});
const edit=(value:ParishEdit['value']):ParishEdit=>({parishSlug:'temple',month:'2026-11',date:'2026-11-15',part:'vecher',gatheringKey:'g',op:'compose',value,baseline:{},createdAt:new Date()});
test('памяти: молебен до четырёх, повечерие до двух; имена берутся из реестра',async()=>{
 const input=validateServiceDetails(['moleben','compline'],{moleben:{memoryIds:['a','b','c','d'],akathist:true},compline:{memoryIds:['e','f']}});
 const details=await resolveServiceDetails(input,async id=>({label:'Память '+id}));
 assert.equal(details.moleben?.memories.length,4);assert.equal(details.compline?.memories.length,2);assert.deepEqual(detailsInput(details),input);
 assert.throws(()=>validateServiceDetails(['moleben'],{moleben:{memoryIds:['a','b','c','d','e'],akathist:false}}));
 assert.throws(()=>validateServiceDetails(['compline-great'],{compline:{memoryIds:['a','b','c']}}));
 assert.throws(()=>validateServiceDetails(['moleben'],{moleben:{memoryIds:['a','a'],akathist:false}}));
 await assert.rejects(resolveServiceDetails(input,async()=>null),/не найдена/);
});
test('молебен с акафистом и собственными памятями сохраняется при правках; чужая подпись следующего дня снимается',()=>{
 const details={moleben:{memories:[{memoryId:'a',label:'Святитель Николай'}],akathist:true}};
 const changed=applyEdits([day([group(['vespers','matins'])])],[edit({services:['moleben'],details})]).days[0].gatherings[0];
 assert.equal(changed.title,'Молебен с акафистом — Святитель Николай');assert.equal(changed.belongsTo,null);assert.deepEqual(changed.details,details);
 const timed=applyEdits([day([changed])],[{...edit({time:'18:00'}),op:'time'}]).days[0].gatherings[0];assert.deepEqual(timed.details,details);
 assert.equal(detailServices([{key:'moleben',label:'Молебен'},{key:'akafist',label:'Акафист'}],details).length,1);
});
test('малое и великое повечерие выбираются отдельно, дополнительные памяти не становятся молебном',()=>{
 assert.deepEqual(serviceSelection(['compline'],'compline-great',true),['compline-great']);
 for(const key of ['compline','compline-great']){
  const details={compline:{memories:[{memoryId:'s',label:'Святой'}]}};
  const g=applyEdits([day([group(['vespers'])])],[edit({services:[key],details})]).days[0].gatherings[0];
  assert.match(g.title,/повечерие — Святой/);assert.equal(g.belongsTo,null);assert.equal(g.details?.moleben,undefined);
 }
});
test('подпись следующего дня есть только при вечерне, утрене, бдении или литургии',()=>{
 for(const keys of [['moleben'],['panihida'],['compline'],['izobrazitelny'],['hour-9']])assert.equal(nextDayLabel(group(keys)),null);
 for(const keys of [['vespers'],['matins'],['vsenoshchnoe'],['liturgy-basil'],['moleben','vespers']])assert.equal(nextDayLabel(group(keys)),'Святой следующего дня');
 assert.equal(nextDayLabel({...group(['vespers']),cancelled:true}),null);
});
test('по умолчанию часы стоят перед своей службой, без дублей, у молебна часы не добавляются',()=>{
 const morning={...group(['hour-6','liturgy-chrysostom']),part:'utro' as const};
 const g=defaultHours(morning);assert.deepEqual(g.services.map(s=>s.key),['hour-3','hour-6','liturgy-chrysostom']);assert.match(g.title,/3-й час/);
 assert.deepEqual(defaultHours(g),g);
 assert.deepEqual(chooseService(['moleben'],'liturgy-chrysostom',true,'utro'),['moleben','hour-3','hour-6','liturgy-chrysostom']);
 assert.deepEqual(chooseService(['hour-3','hour-6','liturgy-chrysostom'],'hour-3',false,'utro'),['hour-6','liturgy-chrysostom']);
 assert.deepEqual(chooseService(['moleben','hour-9','vespers'],'vespers',false,'vecher'),['moleben']);
 const evening=defaultHours(group(['matins','vespers']));assert.equal(evening.services[0].key,'hour-9');assert.match(evening.title,/^9-й час/);
 assert.deepEqual(defaultHours(group(['moleben'])).services.map(s=>s.key),['moleben']);
 assert.deepEqual(defaultHourServices([{key:'izobrazitelny',label:'Изобразительны'}],'utro').map(s=>s.key),['hour-3','hour-6','izobrazitelny']);
});
test('изобразительны заменяют литургию одной службой с часами и не затрагивают вечер',()=>{
 const p=defaultPractice('RU');p.compline='never';p.liturgies.sunday=3;
 const d=day([{...group(['liturgy-basil']),part:'utro'},group(['vespers'])]);
 d.dayConfig=validateDayConfig({date:d.date,memories:[],sign:null,morningService:'typica'});
 const result=applyPractice([d],p)[0];const morning=result.gatherings.filter(g=>g.part==='utro');
 assert.equal(morning.length,1);assert.deepEqual(morning[0].services.map(s=>s.key),['hour-3','hour-6','izobrazitelny']);assert.doesNotMatch(morning[0].title,/Литургия/);
 assert.equal(result.gatherings.filter(g=>g.part==='vecher').length,1);
 const empty=day([]);empty.dayConfig=d.dayConfig;assert.match(applyPractice([empty],p)[0].gatherings[0].title,/Изобразительны/);
 const hours=day([{...group(['matins','hour-3','hour-6']),part:'utro'}]);hours.dayConfig=d.dayConfig;const merged=applyPractice([hours],p)[0].gatherings;assert.equal(merged.length,1);assert.equal(merged[0].services.filter(s=>s.key==='hour-3').length,1);assert.equal(merged[0].services.filter(s=>s.key==='izobrazitelny').length,1);
 assert.throws(()=>validateDayConfig({...d.dayConfig,morningService:'bad'}));
});
test('названия двух и трёх литургий обновляются без изменения времени второй',()=>{
 const p=defaultPractice('RU');p.compline='never';p.liturgies.sunday=2;p.times.sundayEarly.morning='07:00';p.times.sundayOrdinary.morning='09:30';p.times.sundayLate.morning='11:30';
 const d=day([{...group(['liturgy-chrysostom']),part:'utro'}]);
 const two=applyPractice([d],p)[0].gatherings;
 assert.deepEqual(two.map(g=>g.time),['07:00','09:30']);assert.match(two[0].title,/Ранняя/);assert.match(two[1].title,/Поздняя/);
 p.liturgies.sunday=3;const three=applyPractice([d],p)[0].gatherings;assert.match(three[1].title,/Средняя/);assert.equal(three[1].time,'09:30');assert.equal(three[2].time,'11:30');
 const composed=applyEdits([applyPractice([d],p)[0]],[{...edit({services:['hour-3','hour-6','liturgy-basil']}),part:'utro',gatheringKey:'g'}]).days[0].gatherings.find(g=>g.key==='g')!;assert.match(composed.title,/Средняя Литургия Василия/);
 assert.equal(liturgySlotLabel('ordinary',3),'Средняя');assert.equal(timeRowLabel('sundayOrdinary','Воскресенье — обычная',p),'Воскресенье — средняя');
});

test('единое название часов для движка и опубликованных снимков',()=>{
 assert.equal(normalizeHourText('Час 3-й. Час 6-й. Час 9-й. Час 1-й.'),'3-й час. 6-й час. 9-й час. 1-й час.');
 assert.equal(normalizeHourText('3-й час. 6-й час.'),'3-й час. 6-й час.');
 const old={...group(['hour-3','hour-6']),title:'Час 3-й. Час 6-й. Литургия',services:[{key:'hour-3',label:'Час 3-й'},{key:'hour-6',label:'Час 6-й'}]};
 assert.equal(displayGatheringTitle(old),'3-й час. 6-й час. Литургия');assert.equal(old.title,'Час 3-й. Час 6-й. Литургия');
 const normalized=normalizeHours(old);assert.deepEqual(normalized.services.map(s=>s.label),['3-й час','6-й час']);assert.deepEqual(normalizeHours(normalized),normalized);
 const morning=defaultHours({...group(['liturgy-chrysostom']),part:'utro',title:'Литургия',services:[{key:'hour-3',label:'Час 3-й'},{key:'hour-6',label:'Час 6-й'},{key:'liturgy-chrysostom',label:'Литургия'}]});assert.equal(morning.title,'3-й час. 6-й час. Литургия');
});

test('скрытый 9-й час движка не выбран обычным утром, но ручной выбор и постовой порядок сохраняются',()=>{
 const raw={...group(['hour-3','hour-6','hour-9','izobrazitelny','liturgy-chrysostom']),part:'utro' as const,title:'Литургия Иоанна Златоустаго'};
 const p=defaultPractice('RU');p.compline='never';
 const result=applyPractice([day([raw])],p);
 const morning=result[0].gatherings[0];
 assert.deepEqual(morning.services.map(s=>s.key),['hour-3','hour-6','izobrazitelny','liturgy-chrysostom']);
 assert.equal(morning.key,raw.key);
 assert.equal(raw.services.some(s=>s.key==='hour-9'),true);
 const manual=applyEdits(result,[{...edit({services:['hour-9','hour-3','hour-6','liturgy-chrysostom']}),part:'utro'}]).days[0].gatherings[0];
 assert.equal(manual.services.some(s=>s.key==='hour-9'),true);
 const lent={...day([raw]),liturgicalSeason:'velikiy-post'};
 assert.equal(applyPractice([lent],p)[0].gatherings[0].services.some(s=>s.key==='hour-9'),true);
});

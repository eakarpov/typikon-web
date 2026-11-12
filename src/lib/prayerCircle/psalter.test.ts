import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPsalterParts } from './psalter';
import { defaultCommemorations } from '@/lib/pomyannik/commemoration';
const row=(text:string)=>({id:text,kind:'text',text});
test('в полной кафизме поминовение стоит после своей славы, третья по умолчанию без имён',async()=>{
    const defaults=defaultCommemorations(),calls:number[]=[];
    const result=await buildPsalterParts([{psalm:1,from:1,to:2,statia:0},{psalm:2,from:1,to:2,statia:0},{psalm:3,from:1,to:2,statia:1},{psalm:4,from:1,to:2,statia:2}],'kathisma-1',{
        verses:async p=>({rows:[row(`Псалом ${p.psalm}`)],missing:[]}),
        slava:async()=>({rows:[row('Слава')],missing:[]}),
        names:async statia=>{calls.push(statia);const choice=defaults[`psalter-${statia+1}` as 'psalter-1'];return {rows:choice.mode==='none'?[]:[row(choice.mode==='living'?'Живые':'Усопшие')],missing:[]};},
    });
    assert.deepEqual(calls,[0,1,2]);
    assert.deepEqual(result.rows.map(r=>r.text),['Псалом 1','Псалом 2','Слава','Живые','Псалом 3','Слава','Усопшие','Псалом 4','Слава']);
    assert.equal(new Set(result.rows.map(r=>r.id)).size,result.rows.length);
});
test('при чтении одной статии не запрашиваются имена других слав; пропуски не скрываются',async()=>{
    const calls:number[]=[];
    const result=await buildPsalterParts([{psalm:118,from:73,to:131,statia:1}],'k',{
        verses:async()=>({rows:[],missing:['Нет стихов']}),slava:async()=>({rows:[row('Слава')],missing:[]}),
        names:async statia=>{calls.push(statia);return {rows:[row('Выбранная группа')],missing:['Имена неполны']};},
    });
    assert.deepEqual(calls,[1]);assert.ok(result.missing.includes('Нет стихов'));assert.ok(result.missing.includes('Имена неполны'));
});

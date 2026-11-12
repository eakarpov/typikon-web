import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fillMorningCommemorations } from './commemoration';
import type { Row } from './core';
test('утренние имена встраиваются в свои строки без перестановки книжных молитв',()=>{
    const rows:Row[]=[{id:'a',text:'Обычная молитва (имя)',kind:'text',sourceTextId:'other'},
        {id:'b',text:'Спаси (имя).',kind:'text',sourceTextId:'living-female'},
        {id:'c',text:'Упокой (имя).',kind:'text',sourceTextId:'departed'}];
    const ids=new Map([['living-female','living' as const],['departed','departed' as const]]);
    const result=fillMorningCommemorations(rows,ids,{living:[{name:'Марии'}],departed:[{name:'Николая'}]},'f');
    assert.deepEqual(result.map(row=>row.id),['a','b','c']);assert.equal(result[0],rows[0]);
    assert.equal(result[1].text,'Спаси Марии.');assert.equal(result[2].text,'Упокой Николая.');
    assert.equal(rows[1].text,'Спаси (имя).');
});
test('отключённое поминовение оставляет общую молитву, не переносит имена другого раздела',()=>{
    const rows:Row[]=[{id:'a',text:'Помяни (имя).',kind:'text',sourceTextId:'living'}];
    const result=fillMorningCommemorations(rows,new Map([['living','living']]),{living:[],departed:[{name:'Петра'}]},'m');
    assert.equal(result[0].text,'Помяни.');
});

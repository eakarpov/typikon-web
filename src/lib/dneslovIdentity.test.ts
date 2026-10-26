import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dneslovAddress, loadDneslovCard } from './dneslovIdentity';
import { mergeDaySaints } from './daySaints/core';

test('calendar memo id is not a memory id; short_name is never an identifier', () => {
    assert.equal(dneslovAddress({ id: 6352, memory_id: 7974, slug:'цвслн' }), '7974');
    assert.equal(dneslovAddress({ id: 6352, calendary_id:124, slug:'цвслн', short_name:'Флорентий' }), 'цвслн');
    assert.equal(dneslovAddress({ id: 6352, event_id:37014, short_name:'Флорентий' }), null);
    assert.equal(dneslovAddress({ id:7974, slug:'цвслн', short_name:'Флорентий' }), '7974');
});

test('two calendar memoes for one saint merge by canonical slug and retain our curated data', () => {
    const saint = {_id:'own',slug:'florentii',name:'Флорентий',externals:[{source:'dneslov',id:'7974',slug:'цвслн'}]};
    const rows = [{id:6352,calendary_id:1,slug:'цвслн'},{id:12380,calendary_id:2,slug:'цвслн'}];
    const result = mergeDaySaints([saint],rows);
    assert.equal(result.length,1);
    assert.equal(result[0].slug,'florentii');
    assert.equal(result[0].name,'Флорентий');
    assert.equal(mergeDaySaints([],rows)[0].slug,'цвслн');
});

test('old memo-id cache recovers through saved slug and returns genuine memory id', async () => {
    const requests:string[]=[];
    const result=await loadDneslovCard('6352',{id:6352,event_id:37014,slug:'цвслн'},async path => {
        requests.push(path);
        return path.startsWith('/api/') ? {id:7974,slug:'цвслн'} : {memoes:[{description:'Житие'}]};
    });
    assert.equal(result.details.id,7974);
    assert.equal(result.details.memoes[0].description,'Житие');
    assert.equal(requests.length,2);
    assert.ok(requests[0].includes(encodeURIComponent('цвслн')));
    assert.ok(!requests.some(r=>r.includes('6352')));
});

test('memory_id precedes slug; a failed lookup falls back but never requests short_name', async () => {
    const requests:string[]=[];
    await loadDneslovCard('6352',{memory_id:7974,slug:'цвслн',short_name:'Флорентий'},async path=>{
        requests.push(path);
        if(path.includes('7974')) throw new Error('lookup unavailable');
        return path.startsWith('/api/')?{id:7974,slug:'цвслн'}:{memoes:[]};
    });
    assert.ok(requests[0].includes('7974'));
    assert.ok(!requests.some(r=>r.includes(encodeURIComponent('Флорентий'))));
});

test('unavailable upstream never yields an empty successful memory', async () => {
    await assert.rejects(loadDneslovCard('7974',null,async()=>{throw new Error('offline');}));
});

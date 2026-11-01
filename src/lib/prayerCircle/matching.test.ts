import {test} from 'node:test';
import assert from 'node:assert/strict';
import {containsReading} from './matching';
const row=(id:string,text:string)=>({id,text,kind:'text',sourceBook:'molitvoslov',zone:'body'});
test('explicit preparation credit matches content across occurrence prefixes in order',()=>{
 const read=[row('circle:a','A'),row('circle:b','B')];
 assert.equal(containsReading(read,[row('prep:9','A'),row('prep:10','B')]),true);
 assert.equal(containsReading(read,[row('prep:9','B'),row('prep:10','A')]),false);
 assert.equal(containsReading([row('circle:a','A')],[row('prep:9','A'),row('prep:10','A')]),false);
});

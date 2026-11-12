import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parishMutation} from './client';
test('ошибка записи не выдаётся за успешную правку расписания',async()=>{
    const request=(async()=>new Response(JSON.stringify({error:'Нет права редактирования'}),{status:403})) as typeof fetch;
    await assert.rejects(()=>parishMutation('/api/parish/x/edits','POST',{time:'10:00'},request),/Нет права редактирования/);
    await parishMutation('/api/parish/x/edits','POST',{},(async()=>new Response('{}',{status:200})) as typeof fetch);
});

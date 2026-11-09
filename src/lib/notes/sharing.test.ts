import {test} from 'node:test';
import assert from 'node:assert/strict';
test('old text notes and Companion notes use common privacy, links and deletion', {skip:process.env.COMPANION_NOTES_TEST_MONGO!=='1'}, async()=>{
  assert.equal(process.env.MONGODB_URI,'mongodb://127.0.0.1:27131');
  const client=await(await import('../mongodb')).default;
  const {createUserNote,getAllUserNotes,updateUserNote,deleteUserNote}=await import('../../app/api/user-notes/service');
  const {saveNote}=await import('../companion/notesService');
  const {sharing,sharedNote,noteForOwner}=await import('./sharing');
  const {GET}=await import('../../app/api/v2/notes/shared/[token]/route');
  try{
    const owner='common-notes-owner';
    await client.db('typikon-users').collection('userNotes').deleteMany({userId:owner});
    const textId='cccccccccccccccccccccccc';
    const id=await createUserNote(owner,textId,{phrase:'Цитата'},'Прежняя заметка');
    const c=await saveNote(owner,{id:'dddddddddddddddddddddddd',sessionKey:'test-service',nodeId:'node-2',contentHash:'hash2',title:'Вечерня',nodeTitle:'Ектения',selection:{mode:'study',ordo:'vespers'},text:'Заметка к службе',expectedRevision:0,published:false});
    const all=await getAllUserNotes(owner);
    assert.equal(all.length,2);assert.ok(all.some((n:any)=>n.id===c.id&&n.companion));
    assert.equal(await noteForOwner('other',id),null);
    await assert.rejects(sharing('other',{id,expectedRevision:0,expectedNoteRevision:0,published:true}),/not_found/);
    let s=await sharing(owner,{id,expectedRevision:0,expectedNoteRevision:0,published:true});
    const first=s.shareToken!;
    const response=await GET(new Request('http://localhost'),{params:Promise.resolve({token:first})});
    assert.equal(response.status,200);const publicBody=(await response.json()).note;
    assert.deepEqual(Object.keys(publicBody).sort(),['source','text','updatedAt']);
    assert.equal(publicBody.source.href,'/reading/'+textId);assert.equal(publicBody.source.quote,'Цитата');
    assert.equal(JSON.stringify(publicBody).includes(owner),false);
    assert.equal((await noteForOwner(owner,id))!.revision,undefined); // visibility is separate from note revision
    await updateUserNote(owner,id,'Исправленная заметка');
    assert.equal((await sharedNote(first))!.text,'Исправленная заметка');
    s=await sharing(owner,{id,expectedRevision:s.revision,published:false});
    assert.equal(await sharedNote(first),null);
    await assert.rejects(sharing(owner,{id,expectedRevision:s.revision,expectedNoteRevision:0,published:true}),/conflict/); // preview became stale
    const again=await sharing(owner,{id,expectedRevision:s.revision,expectedNoteRevision:1,published:true});
    assert.notEqual(again.shareToken,first);
    await deleteUserNote(owner,id);assert.equal(await sharedNote(again.shareToken!),null);
    const cs=await sharing(owner,{id:c.id,expectedRevision:0,expectedNoteRevision:1,published:true});
    assert.equal((await sharedNote(cs.shareToken!))!.text,'Заметка к службе');
    await assert.rejects(saveNote(owner,{id:c.id,sessionKey:'test-service',nodeId:'node-2',contentHash:'hash2',title:'Вечерня',nodeTitle:'Ектения',selection:{mode:'study',ordo:'vespers'},text:'Правка из старого редактора',expectedRevision:1,expectedSharingRevision:0,published:false}),/conflict/);
    await deleteUserNote(owner,c.id);assert.equal(await sharedNote(cs.shareToken!),null);
  }finally{await client.close();}
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateNote, publicNote, ownNote, type PersonalNote} from './notes';
const input = {id:'aaaaaaaaaaaaaaaaaaaaaaaa', sessionKey:'vespers:2026-11-09', nodeId:'ectenia-2', contentHash:'hash-2', title:'Вечерня', nodeTitle:'Ектения', selection:{mode:'day',date:'2026-11-09',service:'vespers'}, text:'Моя мысль', expectedRevision:0, published:false};
test('publication is explicit; notes require a precise occurrence and valid selection', () => {
  assert.equal(validateNote(input).published, false);
  for (const patch of [{published:undefined},{published:'false'},{nodeId:''},{text:' '},{text:'x'.repeat(10001)},{expectedRevision:-1},{expectedRevision:1.5},{selection:{mode:'day',date:'2026-02-30',service:'vespers'}}]) assert.throws(()=>validateNote({...input,...patch}));
});
test('public projection never exposes ownership, private identifiers or publication token', () => {
  const note = {...input, selection:validateNote(input).selection, userId:'secret-owner', revision:1, shareToken:'secret-token', updatedAt:'2026-11-09T00:00:00Z'} as PersonalNote;
  assert.deepEqual(Object.keys(publicNote(note)).sort(), ['contentHash','nodeId','nodeTitle','selection','text','title','updatedAt'].sort());
  assert.equal(JSON.stringify(publicNote(note)).includes('secret'), false);
  assert.equal('userId' in ownNote(note), false);
  assert.equal(ownNote({...note,shareToken:null}).published, false);
});
test('database privacy, retry, conflict and link revocation', {skip: process.env.COMPANION_NOTES_TEST_MONGO !== '1'}, async () => {
  assert.equal(process.env.MONGODB_URI,'mongodb://127.0.0.1:27131');
  const db = (await import('../mongodb')).default;
  const {saveNote, listNotes, readSharedNote} = await import('./notesService');
  const {GET} = await import('../../app/api/v2/companion/notes/shared/[token]/route');
  const client = await db;
  try {
    await client.db('typikon-users').collection('userNotes').deleteMany({});
    const privateNote = await saveNote('alice', input);
    assert.equal(privateNote.published, false); assert.equal(privateNote.shareToken,null);
    assert.equal((await listNotes('bob',input.sessionKey,input.nodeId)).length,0);
    assert.equal((await listNotes('alice',input.sessionKey,'ectenia-1')).length,0);
    assert.equal((await listNotes('alice',input.sessionKey,input.nodeId)).length,1);
    assert.deepEqual(await saveNote('alice',input),privateNote); // network retry
    await assert.rejects(saveNote('alice',{...input,text:'stale edit'}),/conflict/);
    const published = await saveNote('alice',{...input,expectedRevision:1,published:true});
    assert.match(published.shareToken!,/^[a-f0-9]{48}$/);
    const token = published.shareToken!;
    assert.equal((await readSharedNote(token))?.text,input.text);
    const response = await GET(new Request('http://localhost/'),{params:Promise.resolve({token})});
    assert.equal(response.status,200); assert.match(response.headers.get('Cache-Control')!,/no-store/);
    assert.equal(response.headers.has('X-License'),false);
    assert.equal('userId' in (await response.json()).note,false);
    // Another owner can use the same personal ID without modifying Alice's note.
    await assert.rejects(saveNote('bob',{...input,text:'Bob private'}),/conflict/);
    await saveNote('bob',{...input,id:'bbbbbbbbbbbbbbbbbbbbbbbb',text:'Bob private'});
    assert.equal((await readSharedNote(token))?.text,input.text);
    await saveNote('alice',{...input,expectedRevision:2,expectedSharingRevision:1,published:false});
    assert.equal(await readSharedNote(token),null);
    const gone = await GET(new Request('http://localhost/'),{params:Promise.resolve({token})});
    assert.equal(gone.status,404);
    const republished = await saveNote('alice',{...input,expectedRevision:3,expectedSharingRevision:2,published:true});
    assert.notEqual(republished.shareToken,token);
    assert.equal(await readSharedNote(token),null);
    assert.equal(await readSharedNote('invalid'),null);
    const concurrent = await Promise.allSettled(['first','second'].map(text=>saveNote('alice',{...input,text,expectedRevision:4,expectedSharingRevision:3,published:false})));
    assert.equal(concurrent.filter(x=>x.status==='fulfilled').length,1);
    assert.equal(concurrent.filter(x=>x.status==='rejected').length,1);
  } finally {await client.close();}
});

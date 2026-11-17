import { insertNoteSnapshot, priorSubmission } from './priestSubmissions';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MongoClient, ObjectId, type Db } from 'mongodb';
import { randomUUID } from 'node:crypto';
import { assignNote, dispatchWaiting, ensureQueueIndexes, markQueued, saveQueueSettings,
    slotsOf, takeExtra, waitingFor, enrichAssignment, startService, finishService, createService, expireServices, queuePolicies, repairLegacyQueuePolicies, editService, deleteService } from './priestQueue';
import { dispatchPriestQueue } from './priestDispatch';
import type { ServiceSlot } from './priestQueueRules';
const uri = process.env.TEST_MONGODB_URI;
test('priest queue with a real standalone MongoDB', { skip: !uri }, async t => {
    const client = await new MongoClient(uri!, { serverSelectionTimeoutMS: 5000 }).connect();
    const db = client.db(`priest_queue_test_${randomUUID().replaceAll('-', '')}`);
    const now = new Date();
    const fresh = async () => {
        for (const name of ['priestServices', 'commemorators', 'zapiski', 'pushDevices']) await db.collection(name).deleteMany({});
        await ensureQueueIndexes(db);
        await db.collection('commemorators').insertMany([{ userId: 'p1', title: 'Иерей 1' }, { userId: 'p2', title: 'Иерей 2' }]);
    };
    const service = async (userId: string, patch: Partial<ServiceSlot> = {}) => {
        const s: ServiceSlot = { _id: randomUUID(), userId, active: true, revision: 0,
            kind: 'proskomidia', enabled: true, reminderEnabled: true, namesLimit: 30,
            startsAt: new Date(+now + 1800000), timeZone: 'Europe/Moscow', readyAt: now, entries: [], ...patch };
        await slotsOf(db).insertOne(s); return s;
    };
    const note = async (patch: Record<string, unknown> = {}) => {
        const n = { _id: new ObjectId(), fromUserId: 'reader', toUserId: '', kind: 'proskomidia',
            namesCount: 3, names: [{ name: 'Анна', slavonic: 'А҆́нны', kind: 'living' }],
            readAt: null, sweptAt: null, createdAt: now, queueRequested: true, targetUserId: null, ...patch };
        await db.collection('zapiski').insertOne(n); return n;
    };
    try {
        await t.test('lost submission responses and parallel retries keep one snapshot', async () => {
            await fresh();
            const payload = { fromUserId: 'reader', kind: 'proskomidia', namesCount: 3 };
            const key = { id: 'a'.repeat(32), fingerprint: 'same-request' };
            const saved = await Promise.all(Array.from({ length: 30 }, () => insertNoteSnapshot(db, payload, key)));
            assert.equal(new Set(saved.map(n => String(n._id))).size, 1);
            assert.equal(await db.collection('zapiski').countDocuments({}), 1);
            await assert.rejects(priorSubmission(db, 'reader', { ...key, fingerprint: 'other' }), /другой записки/);
        });
        await t.test('delayed initial fill; repeated workers do not duplicate notes', async () => {
            await fresh(); const s = await service('p1', { readyAt: new Date(+now + 120000) });
            await note(); assert.equal(await dispatchWaiting(db, now), 0);
            assert.equal(await dispatchWaiting(db, new Date(+now + 121000)), 1);
            assert.equal(await dispatchWaiting(db, new Date(+now + 122000)), 0);
            assert.equal((await slotsOf(db).findOne({ _id: s._id }))?.entries.length, 1);
        });
        await t.test('concurrent submissions obey capacity and unique assignment', async () => {
            await fresh(); await service('p1'); await service('p2');
            const notes = await Promise.all(Array.from({ length: 80 }, () => note()));
            await Promise.all(notes.map(n => assignNote(db, n, now)));
            await Promise.all([dispatchWaiting(db, now), dispatchWaiting(db, now)]);
            const slots = await slotsOf(db).find({}).toArray();
            for (const s of slots) assert.ok(s.entries.reduce((n, e) => n + e.namesCount, 0) <= 30);
            const ids = slots.flatMap(s => s.entries.map(e => e.noteId));
            assert.equal(new Set(ids).size, ids.length);
            assert.equal(ids.length, 20);
            assert.equal((await waitingFor(db, 'p1', 'proskomidia')).length, 60);
        });
        await t.test('read is idempotent, owner checked, and does not recycle quota', async () => {
            await fresh(); const s = await service('p1', { namesLimit: 3 }); const n = await note();
            await assignNote(db, n, now);
            assert.equal(await markQueued(db, 'p2', String(n._id), now), false);
            assert.equal(await markQueued(db, 'p1', String(n._id), now), true);
            assert.equal(await markQueued(db, 'p1', String(n._id), now), true);
            const n2 = await note(); assert.equal(await assignNote(db, n2, now), null);
            assert.equal((await slotsOf(db).findOne({ _id: s._id }))!.entries.length, 1);
        });
        await t.test('extras are claimed one at a time, reused after restart and never steal another reservation', async () => {
            await fresh(); const s = await service('p1', { namesLimit: 3 }); await service('p2');
            const n1 = await note({ targetUserId: 'p2' }); await assignNote(db, n1, now);
            const n2 = await note({ targetUserId: 'p1' }); await assignNote(db, n2, now); await markQueued(db, 'p1', String(n2._id), now);
            await startService(db, 'p1', s._id, now);
            const n3 = await note(); const n4 = await note();
            const ids = await Promise.all([takeExtra(db, 'p1', s._id, now), takeExtra(db, 'p1', s._id, now)]);
            assert.equal(ids[0], ids[1]); assert.notEqual(ids[0], String(n1._id));
            assert.ok([String(n3._id), String(n4._id)].includes(ids[0]!));
            assert.equal((await slotsOf(db).findOne({ _id: s._id }))!.entries.filter(e => e.extra).length, 1);
        });
        await t.test('settings cannot silently lower quota or reschedule accepted notes', async () => {
            await fresh(); const s = await service('p1'); const n = await note(); await assignNote(db, n, now);
            const settings = (patch = {}) => ({ donationDetails: 'Реквизиты', services: [
                { ...s, ...patch },
                ...['panihida', 'moleben'].map(kind => ({ ...s, kind, enabled: false, startsAt: null })),
            ] });
            await assert.rejects(saveQueueSettings(db, 'p1', settings({ namesLimit: 2 }), now), /Уже принято/);
            await assert.rejects(saveQueueSettings(db, 'p1', settings({ startsAt: new Date(+now + 7200000) }), now), /Подтвердите перенос/);
            await saveQueueSettings(db, 'p1', { ...settings({ startsAt: new Date(+now + 7200000) }), confirmReschedule: true }, now);
            const assigned = await enrichAssignment(db, n);
            assert.equal(+assigned.assignment!.startsAt!, +now + 7200000);
            assert.equal(assigned.assignment?.donationDetails, 'Реквизиты');
        });
        await t.test('existing unread notes migrate without changing names; new dates archive completed batches', async () => {
            await fresh(); const s = await service('p1');
            const legacy = await note({ toUserId: 'p1', queueRequested: false, targetUserId: null });
            const settings = { donationDetails: '', services: [s,
                ...['panihida', 'moleben'].map(kind => ({ ...s, kind, enabled: false, startsAt: null }))] };
            await saveQueueSettings(db, 'p1', settings, now);
            const migrated = await db.collection('zapiski').findOne({ _id: legacy._id });
            assert.equal(migrated?.targetUserId, 'p1'); assert.equal(migrated?.queueRequested, true);
            assert.deepEqual(migrated?.names, legacy.names);
            await dispatchWaiting(db, now); await markQueued(db, 'p1', String(legacy._id), now);
            const next = { ...settings, services: settings.services.map(v => v.kind === 'proskomidia'
                ? { ...v, startsAt: new Date(+now + 7200000), namesLimit: 1 } : v) };
            await saveQueueSettings(db, 'p1', next, now);
            assert.equal((await slotsOf(db).findOne({ _id: s._id }))?.active, false);
            const active = await slotsOf(db).findOne({ userId: 'p1', kind: 'proskomidia', active: true });
            assert.equal(active?.entries.length, 0); assert.equal(active?.namesLimit, 1);
        });
        await t.test('disabled service keeps its batch and stops new admission', async () => {
            await fresh(); const s = await service('p1'); const n = await note(); await assignNote(db, n, now);
            await slotsOf(db).updateOne({ _id: s._id }, { $set: { enabled: false }, $inc: { revision: 1 } });
            assert.equal(await assignNote(db, await note(), now), null);
            assert.equal((await slotsOf(db).findOne({ _id: s._id }))!.entries.length, 1);
        });
        await t.test('sender cannot submit to himself, or bypass a selected priest', async () => {
            await fresh(); await service('p1'); await service('p2');
            const n = await note({ fromUserId: 'p1', targetUserId: 'p1' });
            assert.equal(await assignNote(db, n, now), null);
        });
        await t.test('reminders are conditional, deduplicated, and dry run is read-only', async () => {
            await fresh(); const s = await service('p1'); const n = await note(); await assignNote(db, n, now);
            await db.collection('pushDevices').insertOne({ userId: 'p1', token: 'test-device' });
            let sent = 0;
            const send = async (_: string, data: Record<string, string>) => {
                assert.deepEqual(Object.keys(data).sort(), ['kind', 'serviceId']); sent++; return 'sent' as const;
            };
            const before = await slotsOf(db).findOne({ _id: s._id });
            await dispatchPriestQueue(db, now, send, true); assert.equal(sent, 0);
            assert.deepEqual(await slotsOf(db).findOne({ _id: s._id }), before);
            await Promise.all([dispatchPriestQueue(db, now, send, false), dispatchPriestQueue(db, now, send, false)]);
            assert.equal(sent, 1);
            await dispatchPriestQueue(db, now, send, false); assert.equal(sent, 1);
        });

        await t.test('policy update retains a reservation that wins after validation', async () => {
            await fresh();
            const slot = await service('p1');
            const n = await note({ targetUserId: 'p1', namesCount: 3 });
            let inserted = false;
            const wrapped = new Proxy(db, { get(target, prop) {
                if (prop !== 'collection') { const value = Reflect.get(target, prop); return typeof value === 'function' ? value.bind(target) : value; }
                return (name: string) => {
                    const col = target.collection(name);
                    if (name !== 'commemorators') return col;
                    return new Proxy(col, { get(c, key) {
                        if (key === 'updateOne') return async (filter: any, update: any, ...rest: any[]) => {
                            if (update.$set?.queuePolicies && !inserted) { inserted = true; await assignNote(db, n, now); }
                            return (c.updateOne as any)(filter, update, ...rest);
                        };
                        const value = Reflect.get(c, key); return typeof value === 'function' ? value.bind(c) : value;
                    } });
                };
            } });
            await saveQueueSettings(wrapped, 'p1', { policyOnly: true, donationDetails: '', services: ['proskomidia','panihida','moleben'].map(kind => ({ kind, enabled: true, reminderEnabled: false, namesLimit: 1, timeZone: 'Europe/Moscow' })) }, now);
            const current = await slotsOf(db).findOne({ _id: slot._id });
            assert.equal(current?.entries.length, 1);
            assert.equal(current?.namesLimit, 3);
        });
        await t.test('legacy consent survives finishing and repairs an already-created disabled instance', async () => {
            await fresh();
            const original = await service('p1', { status: 'finished', active: false, startsAt: new Date(+now - 60000) });
            await db.collection('commemorators').updateOne({ userId: 'p1' }, { $set: { queueConfigured: true } });
            const broken = await service('p1', { status: 'scheduled', enabled: false, readyAt: now });
            const untouched = await service('p1', { status: 'reading', kind: 'panihida', enabled: false });
            assert.equal((await queuePolicies(db,'p1')).find(s=>s.kind==='proskomidia')?.enabled,true);
            assert.equal(await repairLegacyQueuePolicies(db),1);
            assert.equal((await slotsOf(db).findOne({_id:broken._id}))?.enabled,true);
            assert.equal((await slotsOf(db).findOne({_id:original._id}))?.active,false);
            assert.equal((await slotsOf(db).findOne({_id:untouched._id}))?.enabled,false);
            const n=await note({targetUserId:'p1'});
            assert.equal((await assignNote(db,n,now))?._id,broken._id);
            const next=await createService(db,'p1',{kind:'proskomidia',startsAt:new Date(+now+7200000)},now);
            assert.equal((await slotsOf(db).findOne({_id:next}))?.enabled,true);
            assert.equal(await repairLegacyQueuePolicies(db),0);
        });
        await t.test('explicit disabled policies remain disabled; earlier disabled instances do not block enabled services', async () => {
            await fresh();
            await service('p1',{status:'scheduled',enabled:false,startsAt:new Date(+now+100000)});
            const enabled=await service('p1',{status:'scheduled',startsAt:new Date(+now+1800000)});
            assert.equal((await assignNote(db,await note({targetUserId:'p1'}),now))?._id,enabled._id);
            await db.collection('commemorators').updateOne({userId:'p1'},{$set:{queueConfigured:true,queuePolicies:[]}});
            assert.equal(await repairLegacyQueuePolicies(db),0);
            await db.collection('commemorators').deleteMany({userId:'p2'});
            await db.collection('commemorators').insertOne({userId:'p2',title:'Новый иерей'});
            const created=await createService(db,'p2',{kind:'proskomidia',startsAt:new Date(+now+7200000)},now);
            assert.equal((await slotsOf(db).findOne({_id:created}))?.enabled,false);
        });
        await t.test('several instances gate admissions; start freezes batch and survives reload', async () => {
            await fresh();
            await saveQueueSettings(db, 'p1', { policyOnly: true, donationDetails: '', services: ['proskomidia','panihida','moleben'].map(kind => ({ kind, enabled: true, reminderEnabled: false, namesLimit: 30, timeZone: 'Europe/Moscow' })) }, now);
            const first = await createService(db, 'p1', { kind: 'proskomidia', startsAt: new Date(+now + 1800000) }, now);
            const second = await createService(db, 'p1', { kind: 'panihida', startsAt: new Date(+now + 7200000) }, now);
            const third = await createService(db, 'p1', { kind: 'proskomidia', startsAt: new Date(+now + 10800000) }, now);
            const ready = new Date(+now + 121000);
            const n = await note({ targetUserId: 'p1' });
            assert.equal((await assignNote(db, n, ready))?._id, first);
            const later = await note({ kind: 'panihida', targetUserId: 'p1' });
            assert.equal(await assignNote(db, later, ready), null);
            await assert.rejects(markQueued(db, 'p1', String(n._id), ready), /Сначала/);
            const started = await startService(db, 'p1', first, ready);
            assert.equal(started.status, 'reading');
            assert.equal(+started.expiresAt!, +ready + 3600000);
            assert.equal((await startService(db, 'p1', first, new Date(+ready + 1000))).startedAt!.getTime(), +ready);
            await assert.rejects(startService(db, 'p1', second, ready), /Сначала закончите/);
            assert.equal((await assignNote(db, later, ready))?._id, second);
            assert.equal(await assignNote(db, await note({ targetUserId: 'p1' }), ready), null);
            await markQueued(db, 'p1', String(n._id), ready);
            await finishService(db, 'p1', first, ready);
            assert.equal((await slotsOf(db).findOne({ _id: first }))?.status, 'finished');
            assert.equal((await slotsOf(db).findOne({ _id: first }))?.entries.length, 1);
            await startService(db, 'p1', second, ready);
            await expireServices(db, new Date(+ready + 3600000));
            assert.equal((await slotsOf(db).findOne({ _id: second }))?.status, 'expired');
            assert.equal((await slotsOf(db).findOne({ _id: second }))?.entries.length, 0);
            // Released unread notes are pending again, not falsely read.
            assert.equal((await db.collection('zapiski').findOne({ _id: later._id }))?.readAt, null);
            assert.equal((await assignNote(db, await note({ targetUserId: 'p1' }), new Date(+ready + 3600001)))?._id, third);
        });
        await t.test('unstarted service expires at exactly three hours and releases unread notes for reassignment', async () => {
            await fresh();
            const first = await service('p1', {status:'scheduled', startsAt:new Date(+now+60000)});
            const pending = await note();
            await assignNote(db,pending,now);
            const deadline = new Date(+first.startsAt!+3*3600000);
            await expireServices(db,new Date(+deadline-1));
            assert.equal((await slotsOf(db).findOne({_id:first._id}))?.status,'scheduled');
            assert.equal((await slotsOf(db).findOne({_id:first._id}))?.entries.length,1);
            await expireServices(db,deadline);
            const expired = await slotsOf(db).findOne({_id:first._id});
            assert.equal(expired?.status,'expired');assert.equal(expired?.active,false);assert.equal(expired?.entries.length,0);
            assert.equal((await db.collection('zapiski').findOne({_id:pending._id}))?.readAt,null);
            await assert.rejects(startService(db,'p1',first._id,deadline),/завершена/);
            const next = await service('p2',{status:'scheduled',startsAt:new Date(+deadline+3600000)});
            assert.equal(await dispatchWaiting(db,deadline),1);
            assert.equal((await slotsOf(db).findOne({_id:next._id}))?.entries[0].noteId,String(pending._id));
            await expireServices(db,deadline);
            assert.equal((await slotsOf(db).findOne({_id:next._id}))?.entries.length,1);
        });
        await t.test('a service started just before scheduled expiry keeps its own hour; stale expiry cannot close it', async () => {
            await fresh();
            const s = await service('p1',{status:'scheduled',startsAt:new Date(+now-3*3600000+1)});
            await startService(db,'p1',s._id,now);
            // Simulate a worker which had selected the scheduled slot before start.
            await finishService(db,'p1',s._id,new Date(+now+1),true);
            await expireServices(db,new Date(+now+3599999));
            assert.equal((await slotsOf(db).findOne({_id:s._id}))?.status,'reading');
            await expireServices(db,new Date(+now+3600000));
            assert.equal((await slotsOf(db).findOne({_id:s._id}))?.status,'expired');
        });
        await t.test('full quota leaves overflow undated and the next service automatically receives it after its editing window', async () => {
            await fresh();
            await saveQueueSettings(db,'p1',{policyOnly:true,donationDetails:'',services:['proskomidia','panihida','moleben'].map(kind=>({kind,enabled:kind==='proskomidia',reminderEnabled:false,namesLimit:3,timeZone:'Europe/Moscow'}))},new Date(+now-300000));
            const first=await createService(db,'p1',{kind:'proskomidia',startsAt:new Date(+now+3600000)},now);
            const one=await note(),excess=await note();
            assert.equal(await dispatchWaiting(db,new Date(+now+119999)),0);
            assert.equal(await dispatchWaiting(db,new Date(+now+120000)),1);
            assert.equal((await enrichAssignment(db,excess)).queueStatus,'waiting');
            assert.equal((await enrichAssignment(db,excess)).assignment,undefined);
            await startService(db,'p1',first,new Date(+now+121000));await markQueued(db,'p1',String(one._id),new Date(+now+121000));await finishService(db,'p1',first,new Date(+now+122000));
            const second=await createService(db,'p1',{kind:'proskomidia',startsAt:new Date(+now+7200000)},new Date(+now+123000));
            assert.equal(await dispatchWaiting(db,new Date(+now+242999)),0);
            assert.equal((await enrichAssignment(db,excess)).assignment,undefined);
            assert.equal(await dispatchWaiting(db,new Date(+now+243000)),1);
            assert.equal((await enrichAssignment(db,excess)).assignment?.serviceId,second);
            assert.equal((await slotsOf(db).findOne({_id:second}))?.entries.length,1);
        });
        await t.test('edit service only in its draft window; save restarts window and deadline prevents racing admission', async () => {
            await fresh();
            await saveQueueSettings(db,'p1',{policyOnly:true,donationDetails:'',services:['proskomidia','panihida','moleben'].map(kind=>({kind,enabled:true,reminderEnabled:false,namesLimit:30,timeZone:'Europe/Moscow'}))},new Date(+now-300000));
            const id=await createService(db,'p1',{kind:'proskomidia',startsAt:new Date(+now+3600000)},now);
            await assert.rejects(editService(db,'p2',id,{kind:'panihida',startsAt:new Date(+now+7200000)},now),/не найдена/);
            await assert.rejects(startService(db,'p1',id,new Date(+now+30000)),/не готова/);
            await editService(db,'p1',id,{kind:'panihida',startsAt:new Date(+now+7200000),timeZone:'Europe/Moscow'},new Date(+now+60000));
            const edited=await slotsOf(db).findOne({_id:id});assert.equal(edited?.kind,'panihida');assert.equal(+edited!.readyAt,+now+180000);
            assert.equal(+edited!.editableUntil!,+now+180000);
            const n=await note({kind:'panihida'});
            assert.equal(await dispatchWaiting(db,new Date(+now+179999)),0);
            await assert.rejects(editService(db,'p1',id,{kind:'moleben',startsAt:new Date(+now+10800000)},new Date(+now+180000)),/Редактирование закрыто/);
            assert.equal(await dispatchWaiting(db,new Date(+now+180000)),1);
            assert.equal((await slotsOf(db).findOne({_id:id}))?.entries[0].noteId,String(n._id));
            await assert.rejects(editService(db,'p1',id,{kind:'moleben',startsAt:new Date(+now+10800000)},new Date(+now+180001)),/Редактирование закрыто/);
            assert.equal((await slotsOf(db).findOne({_id:id}))?.kind,'panihida');
        });
        await t.test('delete only the owners empty draft before deadline; pending notes survive and next service receives them', async () => {
            await fresh();
            const draft=await service('p1',{status:'scheduled',readyAt:new Date(+now+120000),editableUntil:new Date(+now+120000)});
            const waiting=await note();
            await assert.rejects(deleteService(db,'p2',draft._id,now),/не найдена/);
            await deleteService(db,'p1',draft._id,new Date(+now+119999));
            assert.equal(await slotsOf(db).findOne({_id:draft._id}),null);
            assert.equal((await db.collection('zapiski').findOne({_id:waiting._id}))?.readAt,null);
            assert.equal((await enrichAssignment(db,waiting)).queueStatus,'waiting');
            const next=await service('p1',{status:'scheduled'});
            assert.equal(await dispatchWaiting(db,now),1);
            assert.equal((await enrichAssignment(db,waiting)).assignment?.serviceId,next._id);
        });
        await t.test('delete refuses exact deadline, closed intake window, reservations and reading/finished states', async () => {
            await fresh();
            for(const patch of [
                {editableUntil:now,readyAt:now},
                {editableUntil:new Date(+now+120000),readyAt:now},
                {status:'reading' as const},
                {status:'finished' as const,active:false},
                {entries:[{noteId:String(new ObjectId()),namesCount:1,readAt:null,extra:false}]},
            ]){
                const slot=await service('p1',{kind:'panihida',status:'scheduled',readyAt:new Date(+now+120000),editableUntil:new Date(+now+120000),...patch});
                await assert.rejects(deleteService(db,'p1',slot._id,now),/Удаление закрыто/);
                assert.ok(await slotsOf(db).findOne({_id:slot._id}));
                await slotsOf(db).deleteOne({_id:slot._id});
            }
        });
        await t.test('simultaneous starts permit only one reading service; finished unread notes return to queue', async () => {
            await fresh();
            const a = await service('p1', { status: 'scheduled' });
            const b = await service('p1', { status: 'scheduled', kind: 'panihida' });
            const results = await Promise.allSettled([startService(db,'p1',a._id,now),startService(db,'p1',b._id,now)]);
            assert.equal(results.filter(r => r.status === 'fulfilled').length,1);
            const active = await slotsOf(db).findOne({ userId: 'p1', status: 'reading' });
            assert.ok(active);
            const extra = await note({ kind: active.kind, targetUserId: 'p1' });
            await takeExtra(db, 'p1', active._id, now);
            await finishService(db, 'p1', active._id, now);
            assert.equal((await waitingFor(db,'p1',active.kind)).some(n => String(n._id) === String(extra._id)),true);
            await assert.rejects(takeExtra(db,'p1',active._id,now));
            assert.equal(await markQueued(db,'p1',String(extra._id),now), false);
        });
    } finally { await db.dropDatabase(); await client.close(); }
});

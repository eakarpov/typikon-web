import { READING_PHASES, sourceId, noteCounts, notePartReadAt, pendingView, hydrateEntry, hydrateEntries, hydrateStoredSlot, unreadPart, partsReadAt, syncEntryReads, archiveReadEntry, readableEntries } from './priestReadingParts';
import { randomUUID } from 'node:crypto';
import { ObjectId, type Db, type Filter } from 'mongodb';
import { QueueError, SERVICE_KINDS, fits, parseSettings, rankSlots, usedNames,
    type ServiceSlot, type ReadingPhase, type Reservation } from './priestQueueRules';

// The service document is the authoritative reservation ledger. An atomic
// capacity predicate and a UNIQUE multikey index enforce both capacity and
// single assignment, including across processes, without replica-set transactions.
// Notes retain their original snapshots; the ledger contains IDs and counts only.
export const slotsOf = (db: Db) => db.collection<ServiceSlot>('priestServices');
const notesOf = (db: Db) => db.collection('zapiski');
export async function ensureQueueIndexes(db: Db) {
    const slots = slotsOf(db);
    await slots.createIndex({ 'entries.noteId': 1 }, { unique: true,
        partialFilterExpression: { 'entries.noteId': { $type: 'string' } } });
    // Replace the former one-service-per-kind constraint without touching reservations.
    const indexes = await slots.listIndexes().toArray();
    const old = indexes.find(i => i.name === 'userId_1_kind_1' && i.unique && i.partialFilterExpression?.active === true);
    if (old) await slots.dropIndex(old.name!).catch(e => { if (e.codeName !== 'IndexNotFound') throw e; });
    await slots.createIndex({ userId: 1 }, { name: 'one_reading_service', unique: true,
        partialFilterExpression: { status: 'reading' } });
    await slots.createIndex({ userId: 1, startsAt: 1 });
    await slots.createIndex({ 'entries.sourceNoteId': 1 });
    await notesOf(db).createIndex({ queueRequested: 1, readAt: 1, createdAt: 1 });
}
/** Admission warm-up belongs to the opt-in, not to each new service. */
async function policyReadyAt(db: Db, userId: string, policy: any, now: Date): Promise<Date> {
    if (policy.readyAt) {
        const date = new Date(policy.readyAt);
        if (Number.isFinite(+date)) return date;
    }
    // Older policies did not store their deadline. Reuse an existing consent's
    // earliest deadline, including completed services, rather than restarting it.
    const previous = await slotsOf(db).findOne({userId, kind:policy.kind, enabled:true, readyAt:{$type:'date'}}, {sort:{readyAt:1}});
    return previous?.readyAt ?? now;
}
export async function saveQueueSettings(db: Db, userId: string, body: any, now = new Date()) {
    if (!Array.isArray(body?.services) || body.services.length !== 3)
        throw new QueueError('Нужны настройки трёх видов служб');
    const parsed = body.services.map((s: any) => parseSettings({ ...s, policyOnly: body.policyOnly === true }, now));
    if (new Set(parsed.map((s: any) => s.kind)).size !== 3) throw new QueueError('Виды служб не должны повторяться');
    if (typeof body.donationDetails !== 'string' || body.donationDetails.length > 1000)
        throw new QueueError('Реквизиты: не больше 1000 символов');
    await ensureQueueIndexes(db);
    if (body.policyOnly === true) {
        const previousPolicies = await queuePolicies(db, userId);
        const policies = await Promise.all(parsed.map(async (setting: any) => {
            const previous = previousPolicies.find(p => p.kind === setting.kind);
            return {...setting, startsAt:null, readyAt: !setting.enabled ? null
                : !previous?.enabled ? new Date(+now + 120000)
                : await policyReadyAt(db, userId, previous, now)};
        }));
        const scheduled = await slotsOf(db).find({ userId, active: true, status: { $nin: ['reading', 'finished', 'expired'] } }).toArray();
        for (const setting of parsed) if (scheduled.some(s => s.kind === setting.kind && usedNames(s) > setting.namesLimit))
            throw new QueueError('Лимит меньше уже принятого числа имён', 'conflict');
        await db.collection('commemorators').updateOne({ userId }, { $set: {
            queuePolicies: policies,
            donationDetails: body.donationDetails.trim() || null, queueConfigured: true,
        }, $unset: { queuePolicyMigration: '' } });
        // The policy applies to future admissions; a frozen reading batch never changes.
        for (const setting of policies) await slotsOf(db).updateMany({ userId, active: true,
            status: { $nin: ['reading', 'finished', 'expired'] }, kind: setting.kind }, [{ $set: {
                enabled: setting.enabled,
                // An admission may win after the validation read. Retain that
                // accepted batch instead of putting its ledger above its limit.
                namesLimit: { $max: [setting.namesLimit, { $sum: '$entries.namesCount' }] },
                reminderEnabled: setting.reminderEnabled,
                readyAt: { $max: [setting.readyAt ?? now, '$editableUntil'] },
                revision: { $add: ['$revision', 1] },
        } }]);
        await notesOf(db).updateMany({ toUserId: userId, kind: { $in: [...SERVICE_KINDS] }, readAt: null,
            sweptAt: null, queueRequested: { $ne: true } }, { $set: { queueRequested: true, targetUserId: userId, toUserId: '' } });
        return [];
    }
    const col = slotsOf(db);
    const current = await col.find({ userId, active: true }).toArray();
    // Validate all cards before writing any of them. Each update also uses a
    // revision check, so concurrent reservations cannot be overwritten.
    for (const setting of parsed) {
        const old = current.find(s => s.kind === setting.kind);
        if (old?.status && +old.startsAt! !== +setting.startsAt!) throw new QueueError('Редактируйте службу отдельно в течение двух минут после сохранения', 'conflict');
        if (old && setting.namesLimit < old.entries.filter(e => !e.extra).reduce((n, e) => n + e.namesCount, 0)
            && !(+old.startsAt! !== +setting.startsAt! && old.entries.every(e => e.readAt)))
            throw new QueueError(`Уже принято ${usedNames(old)} имён. Лимит нельзя уменьшить ниже этого объёма`, 'conflict');
        if (old?.entries.some(e => !e.readAt) && +old.startsAt! !== +setting.startsAt!
            && body.confirmReschedule !== true)
            throw new QueueError('На службу уже приняты записки. Подтвердите перенос их даты', 'conflict');
    }
    for (const setting of parsed) {
        const old = current.find(s => s.kind === setting.kind);
        const changedDate = !!old && +old.startsAt! !== +setting.startsAt!;
        if (old?.status && changedDate) throw new QueueError('Редактируйте службу отдельно в течение двух минут после сохранения', 'conflict');
        if (old && changedDate && old.entries.length && old.entries.every(e => e.readAt)) {
            const closed = await col.updateOne({ _id: old._id, revision: old.revision },
                { $set: { active: false }, $inc: { revision: 1 } });
            if (!closed.matchedCount) throw new QueueError('Очередь изменилась. Обновите настройки', 'conflict');
            await col.insertOne({ ...setting, _id: randomUUID(), userId, active: true,
                entries: [], revision: 0, readyAt: new Date(+now + 120000), reminderSentAt: null });
        } else if (old) {
            const update = await col.updateOne({ _id: old._id, revision: old.revision }, {
                $set: { ...setting,
                    readyAt: setting.enabled && (!old.enabled || changedDate)
                        ? new Date(+now + 120000) : old.readyAt,
                    ...(changedDate ? { reminderSentAt: null } : {}),
                }, $inc: { revision: 1 },
            });
            if (!update.matchedCount) throw new QueueError('Очередь изменилась. Обновите настройки', 'conflict');
        } else await col.insertOne({ ...setting, _id: randomUUID(), userId, active: true,
            entries: [], revision: 0, readyAt: new Date(+now + 120000), reminderSentAt: null });
    }
    const savedSlots = await col.find({userId, active:true}).toArray();
    await db.collection('commemorators').updateOne({ userId }, {
        $set: { donationDetails: body.donationDetails.trim() || null, queueConfigured: true,
            queuePolicies: parsed.map((s: any) => ({ ...s, startsAt: null, readyAt: s.enabled ? savedSlots.find(slot => slot.kind === s.kind)?.readyAt ?? now : null })) }, $unset: { queuePolicyMigration: '' },
    });
    // Existing unread one-off notes join the same targeted queue on opt-in.
    // Their names and submission time remain the original immutable snapshot.
    await notesOf(db).updateMany({ toUserId: userId, kind: { $in: [...SERVICE_KINDS] },
        readAt: null, sweptAt: null, queueRequested: { $ne: true } },
        { $set: { queueRequested: true, targetUserId: userId, toUserId: '' } });
    return col.find({ userId, active: true }).toArray();
}
export async function assignmentFor(db: Db, noteId: string) {
    return slotsOf(db).findOne({ 'entries.noteId': noteId });
}
export async function assignNote(db: Db, note: any, now = new Date(), attempt = 0): Promise<ServiceSlot | null> {
    const id = String(note._id ?? note.id);
    const existing = await assignmentFor(db, id);
    if (existing) return existing;
    note = await notesOf(db).findOne({ _id: new ObjectId(id) });
    if (!note) return null;
    note = pendingView(note);
    if (!SERVICE_KINDS.includes(note.kind) || !note.namesCount || note.sweptAt || note.readAt) return null;
    const scheduled = await slotsOf(db).find({ active: true, enabled: true, startsAt: { $gt: now },
        status: { $nin: ['reading', 'finished', 'expired'] } }).sort({ startsAt: 1, _id: 1 }).toArray();
    // Only the nearest scheduled service of each priest receives notes. Starting
    // it atomically closes admissions; the next instance then becomes eligible.
    const heads = new Map<string, ServiceSlot>();
    for (const s of scheduled) if (!heads.has(s.userId)) heads.set(s.userId, s);
    const all = [...heads.values()].filter(s => s.kind === note.kind);
    const approved = new Set((await db.collection('commemorators').find({ userId: { $in: all.map(s => s.userId) } }).toArray()).map(p => p.userId));
    const candidates = rankSlots(all.filter(s => approved.has(s.userId) && s.userId !== note.fromUserId
        && (!note.targetUserId || s.userId === note.targetUserId)
        && fits(s, note.namesCount, now)));
    for (const candidate of candidates) {
        const entry = hydrateEntry({ noteId: id, namesCount: note.namesCount, readAt: null, extra: false }, note);
        try {
            const result = await slotsOf(db).findOneAndUpdate({ _id: candidate._id,
                revision: candidate.revision, active: true, status: { $nin: ['reading', 'finished', 'expired'] }, enabled: true, startsAt: { $gt: now }, 'entries.noteId': { $ne: id },
                $expr: { $lte: [
                    { $add: [{ $sum: '$entries.namesCount' }, note.namesCount] }, '$namesLimit',
                ] },
            }, { $push: { entries: entry }, $set: { lastAssignedAt: now }, $inc: { revision: 1 } },
            { returnDocument: 'after' });
            if (result) return result;
        } catch (e: any) {
            if (e?.code !== 11000) throw e;
            return assignmentFor(db, id); // Another process won the same note.
        }
    }
    if (candidates.length) {
        if (attempt < 8) return assignNote(db, note, now, attempt + 1);
        // Stop this pass instead of letting newer notes overtake a contention.
        throw new QueueError('Очередь изменилась. Повторите подбор', 'conflict');
    }
    return null;
}
export async function dispatchWaiting(db: Db, now = new Date()) {
    await ensureQueueIndexes(db);
    // API submissions and cron use the same cross-process admission lock. The
    // deadline recovers a crashed process; refresh it before each reservation.
    // Wall time is deliberate: `now` may be a simulated service time in tests.
    const locks = db.collection<{_id:string; owner:string; until:Date}>('priestQueueDispatchLocks');
    const owner = randomUUID();
    const deadline = () => new Date(Date.now() + 120000);
    try {
        await locks.insertOne({_id:'fifo', owner, until:deadline()});
    } catch (error: any) {
        if (error?.code !== 11000) throw error;
        const claim = await locks.updateOne({_id:'fifo', until:{$lte:new Date()}},
            {$set:{owner, until:deadline()}});
        if (!claim.matchedCount) return 0; // The active pass includes persisted submissions.
    }
    try {
        await repairLegacyQueuePolicies(db);
        await expireServices(db, now);
        let assigned = 0;
        // ObjectId breaks equal submission timestamps deterministically. Scan
        // the backlog, not just the newly submitted note or a fixed first page.
        for await (const note of notesOf(db).find({ queueRequested: true, readAt: null, sweptAt: null })
            .sort({ createdAt: 1, _id: 1 }).batchSize(100)) {
            const renewed = await locks.updateOne({_id:'fifo',owner,until:{$gt:new Date()}},{$set:{until:deadline()}});
            if (!renewed.matchedCount) break;
            const slot = await assignmentFor(db, String(note._id));
            if (slot) {
                const entry = slot.entries.find(e => e.noteId === String(note._id));
                if (entry) await syncEntryReads(db, entry);
                continue;
            }
            if (await assignNote(db, note, now)) assigned++;
        }
        return assigned;
    } finally {
        await locks.deleteOne({_id:'fifo',owner});
    }
}
export async function queueNotes(db: Db, slot: ServiceSlot, split = false): Promise<any[]> {
    const entries = await hydrateEntries(db, slot);
    const ids = [...new Set(entries.map(sourceId))].filter(id=>/^[a-f0-9]{24}$/i.test(id));
    const notes = await notesOf(db).find({_id:{$in:ids.map(id=>new ObjectId(id))}}).toArray();
    return entries.flatMap(e=>{
        const note=notes.find(n=>String(n._id)===sourceId(e));if(!note)return [];
        if(split && e.parts) return READING_PHASES.filter(p=>e.parts?.[p]).map(part=>({...note,id:String(note._id),part,
            names:note.names.filter((n:any)=>(n.kind==='departed'?'departed':'living')===part),
            namesCount:e.parts![part]!.namesCount,readAt:e.parts![part]!.readAt,extra:e.extra}));
        const shown=READING_PHASES.filter(p=>e.parts?.[p] && (e.readAt || !e.parts[p]!.readAt));
        return [{...note,id:String(note._id),names:e.parts?note.names.filter((n:any)=>shown.includes(n.kind==='departed'?'departed':'living')):note.names,
            namesCount:e.parts?shown.reduce((n,p)=>n+e.parts![p]!.namesCount,0):e.namesCount,readAt:e.readAt,extra:e.extra}];
    });
}
export async function waitingFor(db: Db, userId: string, kind: string) {
    const pending = await notesOf(db).find({ queueRequested: true, kind, readAt: null, sweptAt: null,
        fromUserId: { $ne: userId }, $or: [{ targetUserId: null }, { targetUserId: userId }],
    }).sort({ createdAt: 1, _id: 1 }).toArray();
    const reserved = await slotsOf(db).find({ 'entries.noteId': { $in: pending.map(n => String(n._id)) } }).toArray();
    const ids = new Set(reserved.flatMap(s => s.entries.map(e => e.noteId)));
    return pending.filter(n => !ids.has(String(n._id))).map(pendingView).filter(n=>n.namesCount>0);
}
export async function takeExtra(db: Db, userId: string, slotId: string, now = new Date()) {
    await expireServices(db, now);
    const found = await slotsOf(db).findOne({_id:slotId,userId,active:true});
    if(!found)throw new QueueError('Служба не найдена');
    const slot=await hydrateStoredSlot(db,found);
    if(slot.status!=='reading'||!slot.expiresAt||+now>=+slot.expiresAt)
        throw new QueueError('Эта служба уже завершена. Назначьте следующую дату','conflict');
    const phase=slot.flowVersion===2?slot.readingPhase:undefined;
    const readable=await readableEntries(db,slot);
    if(phase && readable.some(e=>!e.extra&&unreadPart(e,phase)))
        throw new QueueError('Сначала помяните полученные записки этого этапа','conflict');
    const outstanding=readable.find(e=>e.extra&&(phase?unreadPart(e,phase):!e.readAt));
    if(outstanding){
        if(phase && slot.readingMode!=='extra'){
            const changed=await slotsOf(db).updateOne({_id:slotId,revision:slot.revision,status:'reading',readingPhase:phase,expiresAt:{$gt:now}},{$set:{readingMode:'extra'},$inc:{revision:1}});
            if(!changed.matchedCount)throw new QueueError('Этап изменился. Обновите экран','conflict');
        }
        return sourceId(outstanding);
    }
    for(const note of await waitingFor(db,userId,slot.kind)){
        if(phase && !noteCounts(note)[phase])continue;
        const id=String(note._id),entry=hydrateEntry({noteId:id,namesCount:note.namesCount,readAt:null,extra:true},note);
        try{
            const result=await slotsOf(db).updateOne({_id:slotId,userId,revision:slot.revision,status:'reading',expiresAt:{$gt:now},
                ...(phase?{readingPhase:phase}:{})},
                {$push:{entries:entry},...(phase?{$set:{readingMode:'extra' as const}}:{}),$inc:{revision:1}});
            if(result.matchedCount)return id;
            const latest=await slotsOf(db).findOne({_id:slotId,status:'reading',...(phase?{readingPhase:phase}:{})});
            const latestReadable=latest?await readableEntries(db,latest):[];
            const reserved=latestReadable.find(e=>e.extra&&(phase?unreadPart(e,phase):!e.readAt));
            if(reserved)return sourceId(reserved);
            throw new QueueError('Очередь изменилась. Повторите подбор','conflict');
        }catch(e:any){if(e?.code!==11000)throw e;}
    }
    return null;
}
export async function markQueued(db: Db, userId: string, noteId: string, now = new Date(), requestedPart?: ReadingPhase) {
    if(!/^[a-f0-9]{24}$/i.test(noteId))throw new QueueError('Неверный номер записки');
    if(requestedPart !== undefined && !READING_PHASES.includes(requestedPart))throw new QueueError('Неверный этап');
    await expireServices(db,now);
    for(let attempt=0;attempt<8;attempt++){
        const found=await slotsOf(db).findOne({userId,$or:[{'entries.noteId':noteId},{'entries.sourceNoteId':noteId}]},{sort:{active:-1,startsAt:-1}});
        if(!found)return false;
        const slot=await hydrateStoredSlot(db,found),entry=slot.entries.find(e=>sourceId(e)===noteId)!;
        const phase=slot.flowVersion===2?(requestedPart??slot.readingPhase):undefined;
        if(slot.flowVersion===2 && !phase)throw new QueueError('Этап службы не определён','conflict');
        if(phase && entry.parts?.[phase]?.readAt){await syncEntryReads(db,entry);return true;}
        if(!phase && entry.readAt){await syncEntryReads(db,entry);return true;}
        if(slot.status && slot.status!=='reading')throw new QueueError('Сначала начните поминовение','conflict');
        if(phase && (phase!==slot.readingPhase || !entry.parts?.[phase]))throw new QueueError('Эта часть записки относится к другому этапу','conflict');
        if(phase && entry.extra && slot.readingMode!=='extra')throw new QueueError('Сначала выберите дополнительное поминовение','conflict');
        const original=await notesOf(db).findOne({_id:new ObjectId(noteId),sweptAt:null});
        if(!original)throw new QueueError('Имена удалены по сроку хранения. Записку нельзя отметить помянутой','conflict');
        const parts={...entry.parts};
        for(const p of READING_PHASES)if(parts[p]&&(!phase||p===phase))parts[p]={...parts[p]!,readAt:parts[p]!.readAt??now};
        const updatedEntry={...entry,parts,readAt:partsReadAt(parts)};
        const update=await slotsOf(db).updateOne({_id:slot._id,revision:slot.revision,...(slot.status?{status:'reading',expiresAt:{$gt:now}}:{}),...(phase?{readingPhase:phase}:{})},
            {$set:{entries:slot.entries.map(e=>e.noteId===entry.noteId?updatedEntry:e)},$inc:{revision:1}});
        if(update.matchedCount){await syncEntryReads(db,updatedEntry);return true;}
    }
    throw new QueueError('Служба или очередь изменилась. Обновите экран','conflict');
}
export async function advanceReadingPhase(db: Db, userId: string, id: string, now=new Date()) {
    await expireServices(db,now);
    const found=await slotsOf(db).findOne({_id:id,userId});if(!found)throw new QueueError('Служба не найдена');
    const slot=await hydrateStoredSlot(db,found);
    if(slot.flowVersion!==2||slot.status!=='reading'||!slot.expiresAt||slot.expiresAt<=now)throw new QueueError('Поминовение не активно','conflict');
    if(slot.kind!=='proskomidia')throw new QueueError('У этой службы нет второго этапа','conflict');
    if(slot.readingPhase==='departed')return;
    if((await readableEntries(db,slot)).some(e=>unreadPart(e,'living')))throw new QueueError('Сначала помяните текущие записки о здравии','conflict');
    const result=await slotsOf(db).updateOne({_id:id,userId,revision:slot.revision,status:'reading',readingPhase:'living',expiresAt:{$gt:now}},
        {$set:{readingPhase:'departed',readingMode:'batch'},$inc:{revision:1}});
    if(!result.matchedCount){
        const current=await slotsOf(db).findOne({_id:id,userId,status:'reading',readingPhase:'departed',expiresAt:{$gt:now}});
        if(!current)throw new QueueError('Этап изменился. Обновите экран','conflict');
    }
}
export async function enrichAssignment(db: Db, note: any): Promise<{[key:string]:any;partStatuses:{part:ReadingPhase;namesCount:number|undefined;readAt:Date|null;queueStatus:string;assignment:any}[]}> {
    const id=String(note._id??note.id);
    const original=await notesOf(db).findOne({_id:new ObjectId(id)})??note;
    const all=await slotsOf(db).find({$or:[{'entries.noteId':id},{'entries.sourceNoteId':id}]}).sort({startsAt:1}).toArray();
    const refs=all.flatMap(slot=>slot.entries.filter(e=>sourceId(e)===id).map(e=>({slot,entry:hydrateEntry(e,original)})));
    const priests=await db.collection('commemorators').find({userId:{$in:all.map(s=>s.userId)}}).toArray();
    const assignment=(slot:ServiceSlot)=>{const p=priests.find(p=>p.userId===slot.userId);return {serviceId:slot._id,startsAt:slot.startsAt,timeZone:slot.timeZone,title:p?.title??'',place:p?.place??null,donationDetails:p?.donationDetails??null};};
    const counts=noteCounts(original);
    const partStatuses=READING_PHASES.filter(p=>counts[p]).map(part=>{
        const read=refs.find(r=>r.entry.parts?.[part]?.readAt),current=refs.find(r=>r.slot.active&&r.entry.parts?.[part]&&!r.entry.parts[part]!.readAt);
        const readAt=notePartReadAt(original,part)??read?.entry.parts?.[part]?.readAt??null;
        return {part,namesCount:counts[part],readAt,queueStatus:readAt?'read':original.sweptAt?'expired':current?'assigned':'waiting',assignment:original.sweptAt&&!readAt?null:current?assignment(current.slot):read?assignment(read.slot):null};
    });
    const complete=partStatuses.length>0&&partStatuses.every(p=>p.readAt);
    const anyRead=partStatuses.some(p=>p.readAt);
    const current=refs.find(r=>r.entry.noteId===id);
    const readAt=original.readAt??(complete?new Date(Math.max(...partStatuses.map(p=>+p.readAt!))):null);
    return {...note,readAt,partStatuses,queueStatus:original.queueRequested?(readAt?'read':original.sweptAt?'expired':anyRead?'partially-read':current?'assigned':'waiting'):null,
        ...(current&&(!original.sweptAt||readAt)?{assignment:assignment(current.slot)}:{})};
}

/** Legacy dated slots remain usable; undated cards are policies, not services. */
export async function queuePolicies(db: Db, userId: string) {
    const priest = await db.collection('commemorators').findOne({ userId });
    if (Array.isArray(priest?.queuePolicies)) return priest.queuePolicies;
    // The legacy configuration lived in the dated batch itself. A newly created
    // scheduled instance must never replace that consent with default-off values.
    const old = await slotsOf(db).find({ userId, status: { $ne: 'scheduled' } })
        .sort({ readyAt: -1, startsAt: -1 }).toArray();
    return SERVICE_KINDS.map(kind => {
        const s = old.find(s => s.kind === kind);
        return { kind, enabled: s?.enabled ?? false, namesLimit: s?.namesLimit ?? 30,
            reminderEnabled: s?.reminderEnabled ?? false, timeZone: s?.timeZone ?? 'Europe/Moscow', startsAt: null, readyAt: s?.enabled ? s.readyAt : null };
    });
}
/** One-time compatibility repair for accounts configured before separate policies. */
export async function repairLegacyQueuePolicies(db: Db, onlyUserId?: string) {
    let repaired = 0;
    const query = { queueConfigured: true, $or: [{ queuePolicies: { $exists: false } }, { queuePolicyMigration: 'pending' }],
        ...(onlyUserId ? { userId: onlyUserId } : {}) };
    for (const priest of await db.collection('commemorators').find(query).toArray()) {
        const policies = await queuePolicies(db, priest.userId);
        if (!Array.isArray(priest.queuePolicies)) {
            const result = await db.collection('commemorators').updateOne({ userId: priest.userId, queuePolicies: { $exists: false } },
                { $set: { queuePolicies: policies, queuePolicyMigration: 'pending' } });
            if (!result.matchedCount) continue; // A priest's explicit edit wins.
        }
        const services = await slotsOf(db).find({ userId: priest.userId, active: true, status: 'scheduled' }).toArray();
        for (const service of services) {
            if (!await db.collection('commemorators').findOne({ userId: priest.userId, queuePolicyMigration: 'pending' })) break;
            const policy = policies.find(p => p.kind === service.kind);
            if (!policy) continue;
            await slotsOf(db).updateOne({ _id: service._id, revision: service.revision, active: true, status: 'scheduled' }, [{ $set: {
                enabled: policy.enabled, reminderEnabled: policy.reminderEnabled,
                namesLimit: { $max: [policy.namesLimit, { $sum: '$entries.namesCount' }] },
                revision: { $add: ['$revision', 1] },
            } }]);
        }
        await db.collection('commemorators').updateOne({ userId: priest.userId, queuePolicyMigration: 'pending' },
            { $unset: { queuePolicyMigration: '' } });
        repaired++;
    }
    return repaired;
}
export async function createService(db: Db, userId: string, body: any, now = new Date()) {
    await ensureQueueIndexes(db);
    await repairLegacyQueuePolicies(db, userId);
    const policies = await queuePolicies(db, userId);
    const policy = policies.find(s => s.kind === body?.kind);
    if (!policy) throw new QueueError('Неизвестный вид службы');
    const parsed = parseSettings({ ...policy, enabled: true, startsAt: body.startsAt, timeZone: body.timeZone ?? policy.timeZone }, now);
    const readyAt = new Date(Math.max(+now + 120000, +await policyReadyAt(db, userId, policy, now)));
    if (parsed.startsAt! <= readyAt) throw new QueueError('Укажите время службы позже двухминутного окна редактирования');
    const service: ServiceSlot = { ...parsed, enabled: policy.enabled, _id: randomUUID(), userId,
        active: true, status: 'scheduled', entries: [], revision: 0,
        readyAt, editableUntil: readyAt, reminderSentAt: null };
    await db.collection('commemorators').updateOne({ userId, queuePolicies: { $exists: false } },
        { $set: { queuePolicies: policies, queueConfigured: true } });
    await slotsOf(db).insertOne(service);
    return service._id;
}
/** A service remains a draft until its admission deadline, with no reservations. */
export async function editService(db: Db, userId: string, id: string, body: any, now = new Date()) {
    const col = slotsOf(db), slot = await col.findOne({_id:id,userId});
    if (!slot) throw new QueueError('Служба не найдена');
    if (!slot.active || slot.status !== 'scheduled' || !slot.editableUntil || slot.editableUntil <= now || slot.entries.length)
        throw new QueueError('Редактирование закрыто: двухминутное окно истекло или поминовение уже началось', 'conflict');
    const policy = (await queuePolicies(db,userId)).find(p => p.kind === body?.kind);
    if (!policy) throw new QueueError('Неизвестный вид службы');
    const parsed = parseSettings({...policy,enabled:true,startsAt:body.startsAt,timeZone:body.timeZone ?? slot.timeZone},now);
    const readyAt = new Date(Math.max(+now+120000,+await policyReadyAt(db,userId,policy,now)));
    if (parsed.startsAt! <= readyAt) throw new QueueError('Укажите время службы позже двухминутного окна редактирования');
    const result = await col.updateOne({_id:id,userId,revision:slot.revision,active:true,status:'scheduled',editableUntil:{$gt:now},entries:{$size:0}},
        {$set:{...parsed,enabled:policy.enabled,readyAt,editableUntil:readyAt,reminderSentAt:null},$inc:{revision:1}});
    if (!result.matchedCount) throw new QueueError('Служба изменилась. Обновите список', 'conflict');
}
/** Only an empty, unpublished draft may be deleted. Reservations are never removed here. */
export async function deleteService(db: Db, userId: string, id: string, now = new Date()) {
    const col = slotsOf(db), slot = await col.findOne({_id:id,userId});
    if (!slot) throw new QueueError('Служба не найдена');
    const result = await col.deleteOne({_id:id,userId,revision:slot.revision,active:true,status:'scheduled',
        editableUntil:{$gt:now},readyAt:{$gt:now},entries:{$size:0}});
    if (!result.deletedCount) throw new QueueError('Удаление закрыто: двухминутное окно истекло или подбор записок уже начался', 'conflict');
}
const expiryFilter = (now: Date): Filter<ServiceSlot> => ({ active: true, $or: [
    { status: 'reading', expiresAt: { $lte: now } },
    { status: { $nin: ['reading', 'finished', 'expired'] }, startsAt: { $lte: new Date(+now - 3 * 3600000) } },
] });
const isDue = (slot: ServiceSlot, now: Date) => slot.active && (slot.status === 'reading'
    ? !!slot.expiresAt && +slot.expiresAt <= +now
    : slot.status !== 'finished' && slot.status !== 'expired' && !!slot.startsAt && +slot.startsAt + 3 * 3600000 <= +now);
export async function finishService(db: Db, userId: string, id: string, now = new Date(), expired = false) {
    for (let attempt = 0; attempt < 8; attempt++) {
        const slot = await slotsOf(db).findOne({ _id: id, userId });
        if (!slot) throw new QueueError('Служба не найдена');
        if (slot.status === 'finished' || slot.status === 'expired') return;
        // The service may have started since the worker selected it. Recheck
        // its current deadline on every CAS retry so a fresh reading survives.
        if (expired && !isDue(slot, now)) return;
        if (!expired && slot.status !== 'reading') throw new QueueError('Поминовение не начато', 'conflict');
        const entries = await hydrateEntries(db,slot);
        for (const entry of entries) await syncEntryReads(db,entry);
        if (!expired && slot.flowVersion===2 && slot.kind==='proskomidia' && slot.readingPhase==='living')
            throw new QueueError('Сначала перейдите к поминовению усопших','conflict');
        const read = entries.map(e=>archiveReadEntry(e,slot._id)).filter((e):e is Reservation=>e!==null);
        const released = entries.filter(e=>e.parts?Object.values(e.parts).some(p=>!p.readAt):!e.readAt).length;
        // Release unread reservations atomically. Their original notes are still
        // pending; a subsequent dispatch assigns them to the next eligible service.
        const result = await slotsOf(db).updateOne({ _id: id, userId, revision: slot.revision, ...(expired ? expiryFilter(now) : {}) }, {
            $set: { active: false, status: expired ? 'expired' : 'finished', finishedAt: now,
                entries: read, releasedNotes: released } as any,
            $inc: { revision: 1 },
        });
        if (result.matchedCount) return;
    }
    throw new QueueError('Очередь изменилась. Повторите завершение', 'conflict');
}
export async function expireServices(db: Db, now = new Date()) {
    for (const s of await slotsOf(db).find(expiryFilter(now)).toArray())
        await finishService(db, s.userId, s._id, now, true);
}
export async function startService(db: Db, userId: string, id: string, now = new Date(), twoStage = false) {
    await ensureQueueIndexes(db);await expireServices(db,now);
    const existing=await slotsOf(db).findOne({userId,status:'reading'});
    if(existing && existing._id!==id)throw new QueueError('Сначала закончите текущее поминовение','conflict');
    if(existing && (!twoStage || existing.flowVersion===2))return existing;
    for(let attempt=0;attempt<8;attempt++){
        const slot=await slotsOf(db).findOne({_id:id,userId,active:true});
        if(!slot)throw new QueueError('Служба уже завершена или не найдена','conflict');
        const entries=await hydrateEntries(db,slot);
        let phase:ReadingPhase=slot.kind==='panihida'?'departed':'living';
        if(twoStage && slot.kind==='proskomidia' && !(await readableEntries(db,{...slot,entries})).some(e=>unreadPart(e,'living'))){
            const waiting=await waitingFor(db,userId,slot.kind);
            if(!waiting.some(n=>noteCounts(n).living))phase='departed';
        }
        const upgrading=slot.status==='reading';
        try{
            const result=await slotsOf(db).findOneAndUpdate({_id:id,userId,active:true,revision:slot.revision,
                ...(upgrading?{status:'reading',expiresAt:{$gt:now}}:{readyAt:{$lte:now},startsAt:{$gt:new Date(+now-3*3600000)},status:{$nin:['reading','finished','expired']}})},
                {$set:{status:'reading',entries,...(!upgrading?{startedAt:now,expiresAt:new Date(+now+3600000)}:{}),
                    ...(twoStage?{flowVersion:2,readingPhase:phase,readingMode:'batch' as const}:{})},$inc:{revision:1}},{returnDocument:'after'});
            if(result)return result;
        }catch(e:any){if(e.code===11000)throw new QueueError('Уже начато другое поминовение. Обновите экран','conflict');throw e;}
        const current=await slotsOf(db).findOne({_id:id,userId});
        if(current?.status==='reading'&&(!twoStage||current.flowVersion===2))return current;
        if(!current||current.status==='finished'||current.status==='expired'||current.readyAt>now)
            throw new QueueError('Служба ещё не готова к началу, завершена или не найдена','conflict');
    }
    throw new QueueError('Служба изменилась. Обновите экран','conflict');
}

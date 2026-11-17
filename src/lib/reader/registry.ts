import type { Db } from 'mongodb';
import config from '@/data/reader/pilot.json';
import { newId, revision, nativeKey, sha, fail, type Obj, PILOT, canonical } from './core';
import { loadNative, rules } from './native';
import { prepareLegacy } from './legacy';
import { profileSets, project } from './projection';
import { freezePassport } from './passport';
import { checkPassport } from './acceptance';

export async function readerDb() { const { default: client } = await import('@/lib/mongodb'); return (await client).db('typikon'); }
export async function identity(db: Db, key: string, prefix: string) { const c = db.collection<any>('readerIdentities'); const old = await c.findOne({ _id: key }); if (old) return old.id; try { const id = newId(prefix); await c.insertOne({ _id: key, id, createdAt: new Date() }); return id; } catch (error) { if ((error as any).code !== 11000) throw error; return (await c.findOne({ _id: key }))!.id; } }
async function immutable(db: Db, collection: string, id: string, data: Obj) {if(collection==='readerPassports'){const previous=await db.collection<any>(collection).findOne({_id:id});if(previous&&canonical(previous.data)!==canonical(data.data))fail('map_revision_mismatch',409,'Паспорт изменён без новых ревизий наблюдений.');} const c = db.collection<any>(collection); await c.updateOne({ _id: id }, { $setOnInsert: { _id: id, ...data } }, { upsert: true }); }
export function passportData(key: string, sourceId: string, evidence: Obj = config.evidence): Obj {
     const names: Record<string, string[]> = { P01: ['sub:canon'], P02: ['sub:akathist', 'sub:ak-source'], P03: ['sub:chapter', 'sub:book', 'sub:text', 'sub:manuscript'], P04: ['sub:irmos'], P05: [] }; const selected = names[key];
    const assertions = evidence.assertions.filter((x: Obj) => selected.includes(x.subjectId)); const questions = evidence.questions.filter((x: Obj) => selected.includes(x.subjectId)).map((x: Obj) => ({ ...x, revision: x.revision ?? 1 })); const cases = evidence.cases.filter((x: Obj) => selected.includes(x.subjectId)).map((x: Obj) => ({ ...x, revision: x.revision ?? 1 }));
    const obsIds = new Set([...assertions.flatMap((x: Obj) => x.evidenceLinks.map((v: Obj) => v.observationId)), ...questions.flatMap((x: Obj) => x.checkedObservationIds)]); const observations = evidence.observations.filter((x: Obj) => obsIds.has(x.id)).map((x: Obj) => ({ ...x, revision: x.revision ?? 1 })); const sources = evidence.sources.filter((x: Obj) => observations.some((o: Obj) => o.sourceRef === x.id));
    const fields: Obj = {}; if (key === 'P03') { fields.authorship = { state: 'candidate', display: 'Атрибуция Иоанну Златоусту унаследована от сборника; глава отдельно не проверена.', assertionIds: ['assert:chapter-author-candidate'], questionIds: ['q:chapter-author'] }; fields.translator = { state: 'unknown', display: 'Переводчик не установлен.', assertionIds: [], questionIds: ['q:chapter-translator'] }; } if (key === 'P04') fields.originalPartOf = { state: 'unknown', display: 'Родной канон ирмоса не установлен.', assertionIds: [], questionIds: ['q:irmos-original'] };
    const data = { sourceId, fields, subjects: evidence.subjects.filter((x: Obj) => selected.includes(x.id)), assertions, sources, observations, questions, cases, reviewEvents: [] };
    // Versioned references and the passport digest are assigned by freezePassport.
    return data;
}
const slugs: Record<string, string> = { P01: 'oktoih-glas-1-krestovoskresny-kanon', P02: 'akafist-nikolayu-chudotvorcu', P03: 'margarit-beseda-1', P04: 'irmos-hristos-rozhdaetsya-v-oktoihe', P05: 'pravilo-very-nikolayu' };
export async function publishPilot(db: Db, { apply = false, activate = false, progress = (_message: string) => { }, pilotConfig = config } = {}) {
    async function publication(){
        const preview=new Map<number,number>();
        const legacy=await prepareLegacy(db,apply,progress,(publicId,nativeId)=>preview.set(publicId,nativeId));
        const ds=rules().datasetRevision;
        const materials=[];
        for(const material of pilotConfig.materials){
            const m=structuredClone(material);
            if(m.nativeRef.kind==='chant'){
                const registered=await db.collection<any>('readerSources').findOne({pilotId:PILOT,aliases:slugs[m.id]});
                if(registered){
                    const publicId=Number(registered.source.legacyTarget.id);
                    const binding=await db.collection<any>('readerLegacyBindings').findOne({_id:ds+':'+publicId});
                    const nativeId=binding?.nativeId??preview.get(publicId);
                    if(nativeId===undefined)fail('ambiguous',409,'Пилотный источник не сопоставлен с новой сборкой.');
                    m.nativeRef.id=String(nativeId);
                }
            }
            materials.push(m);
        }
    // Validate every native source and every full projection before writing a release.
    const loaded = new Map<string, Obj>(); for (const m of materials) { const n = await loadNative(db, m.nativeRef); if (m.id === 'P03' && sha(n.items[0].raw) !== pilotConfig.expectedLibrarySha256) fail('map_revision_mismatch', 409, 'Исходная глава изменилась: нужна новая редакторская сверка.'); for (const item of n.items) { for (const ps of profileSets) project({ raw: item.raw, bodyId: 'bdy_00000000000040008000000000000001', bodyRevision: 'br1_' + sha(item.raw), chant: m.nativeRef.kind !== 'text' }, ps.id); } loaded.set(m.id, n); }
        if(!apply)return {dryRun:true,pilotId:PILOT,materials:materials.map(m=>({id:m.id,nativeRef:m.nativeRef,units:loaded.get(m.id)!.items.length})),noTextCopied:true};
        for (const ps of profileSets) { const old = await db.collection<any>('readerProfiles').findOne({ _id: ps.id }); if (old && canonical(old.profile) !== canonical(ps)) fail('unsupported_profile', 422, 'Профиль изменился без нового ID.'); await immutable(db, 'readerProfiles', ps.id, { profile: ps }); }
        const sources = new Map<string, string>(); for (const m of materials) { const ref = m.nativeRef; let key = ref.kind + ':' + ref.id; if (ref.kind === 'chant') { const mapped = await db.collection<any>('readerLegacyBindings').findOne({ datasetRevision: ds, nativeId: Number(ref.id) }); if (!mapped) fail('corpus_unavailable', 503, 'Не подготовлен legacy ID.'); key = 'chant:' + mapped.publicId; } sources.set(m.id, await identity(db, 'source:' + key, 'src')); }
        const entries: Obj[] = [];
        for (const m of materials) {            
const n = loaded.get(m.id)!, sourceId = sources.get(m.id)!, units: Obj[] = [], bodyBindingIds: string[] = []; const datasets = new Set<string>();
            for (const item of n.items) {
                let occurrenceKey: string, bodyKey = nativeKey(item.ref); let publicId: number | undefined;
                if (item.row) {                    
const map = await db.collection<any>('readerLegacyBindings').findOne({ datasetRevision: ds, nativeId: item.row.item_id }); publicId = map.publicId;
                    const parent = m.id === 'P04' ? sources.get('P01')! : sourceId; occurrenceKey = parent + ':' + publicId;
                    if (item.ref.namespace === 'rules.content_items') { const owner = await db.collection<any>('readerLegacyBindings').findOne({ datasetRevision: ds, nativeId: Number(item.ref.id) }); if (!owner) fail('corpus_unavailable', 503, 'Не зарегистрирован владелец тела.'); bodyKey = 'rules.content_items:public:' + owner.publicId; }
                } else occurrenceKey = sourceId + ':root';
                const occurrenceId = await identity(db, 'occurrence:' + occurrenceKey, 'occ'); const bodyId = await identity(db, 'body:' + bodyKey, 'bdy'); const br = 'br1_' + sha(item.raw);
                const datasetRevision = item.row ? ds : revision('ds1', { profile: 'dataset-r1', artifacts: [{ name: 'texts/' + m.nativeRef.id, sha256: sha(item.raw) }] }); datasets.add(datasetRevision);
                const bindingId = bodyId + ':' + br + ':' + datasetRevision; await immutable(db, 'readerBodyBindings', bindingId, { bodyId, bodyRevision: br, datasetRevision, nativeRef: item.ref, chant: !!item.row, sourceId }); bodyBindingIds.push(bindingId);
                units.push({ occurrenceId, bodyId, bodyRevision: br, placement: item.placement, repeatCount: item.repeatCount, rubricRevision: item.rubric == null ? null : 'br1_' + sha(item.rubric) });
            }
            const footnotes: Obj[] = [];
            for (let index = 0; index < n.footnotes.length; index++) { const raw = n.footnotes[index]; if (typeof raw !== 'string') fail('projection_unavailable', 503, 'Сноска не является текстом.'); const bodyId = await identity(db, 'body:footnote:' + m.nativeRef.id + ':' + index, 'bdy'); const br = 'br1_' + sha(raw); const dsNote = revision('ds1', { profile: 'dataset-r1', artifacts: [{ name: 'footnote/' + index, sha256: sha(raw) }] }); const id = bodyId + ':' + br + ':' + dsNote; await immutable(db, 'readerBodyBindings', id, { bodyId, bodyRevision: br, datasetRevision: dsNote, nativeRef: { namespace: 'typikon.texts', id: m.nativeRef.id }, footnoteIndex: index, chant: false, sourceId }); bodyBindingIds.push(id); footnotes.push({ bodyId, bodyRevision: br }); }
            const descriptor = { profile: 'source-r1', sourceId, kind: m.nativeRef.kind, units, footnotes }; const sourceRevision = revision('sr1', descriptor); const incoming=passportData(m.id,sourceId,pilotConfig.evidence);
            const active=await db.collection<any>('readerPilots').findOne({_id:PILOT});
            const priorRelease=active?.activeRelease?await db.collection<any>('readerReleases').findOne({_id:active.activeRelease}):null;
            const priorEntry=priorRelease?.entries.find((e:Obj)=>e.sourceId===sourceId);
            const priorPassport=priorEntry?await db.collection<any>('readerPassports').findOne({_id:priorEntry.passportRevision}):null;
            if(priorPassport){
                const previous=priorPassport.data;
                const protectedHistory=previous.reviewEvents.length||previous.cases.some((c:Obj)=>c.assertionIds.length>1||c.preferredAssertionIds.length)||previous.assertions.some((a:Obj)=>['accepted','rejected'].includes(a.reviewStatus));
                const content=(p:Obj)=>({assertions:p.assertions,observations:p.observations,cases:p.cases,questions:p.questions,fields:p.fields,reviewEvents:p.reviewEvents});
                if(protectedHistory&&canonical(content(previous))!==canonical(content(incoming)))fail('map_revision_mismatch',409,'Импорт не может затереть редакторские решения или альтернативные атрибуции.');
            }
            const passport=await freezePassport(db,incoming);checkPassport(passport);
            await immutable(db, 'readerSourceVersions', sourceRevision, { sourceId, descriptor }); await immutable(db, 'readerPassports', passport.passportRevision, { sourceId, data: passport });
            const legacyTarget = m.nativeRef.kind === 'text' ? n.legacyTarget : m.nativeRef.kind === 'chant' ? { kind: 'chant', id: String((await db.collection<any>('readerLegacyBindings').findOne({ datasetRevision: ds, nativeId: Number(m.nativeRef.id) }))!.publicId), ...(n.items[0].row.source_book ? { edition: n.items[0].row.source_book } : {}) } : null;
            const source = { sourceId, kind: m.nativeRef.kind, title: m.title, canonicalUrl: 'https://www.typikon.info/sources/id/' + sourceId, editorialStatus: n.editorialStatus, sourceRights: { status: 'unresolved', licenseId: null, licenseUrl: null, conditions: null }, legacyTarget };
            await db.collection<any>('readerSources').updateOne({ _id: sourceId }, { $setOnInsert: { _id: sourceId, slug: slugs[m.id], aliases: [slugs[m.id]], nativeRef: m.nativeRef, pilotId: PILOT }, $set: { source } }, { upsert: true });
            const entry = { sourceId, sourceRevision, passportRevision: passport.passportRevision, datasetRevisions: [...datasets], bodyBindingIds, nativeRef: m.nativeRef, source, language: n.language }; entries.push(entry);
            for (const unit of units) { const fragmentId = await identity(db, 'fragment:' + sourceId + ':' + unit.occurrenceId, 'frg'); await immutable(db, 'readerFragments', fragmentId, { sourceId, occurrenceId: unit.occurrenceId }); const prior = await db.collection<any>('readerFragmentBindings').findOne({ fragmentId }); if (!prior || prior.bodyRevision === unit.bodyRevision) await immutable(db, 'readerFragmentBindings', fragmentId + ':' + sourceRevision, { fragmentId, sourceId, sourceRevision, occurrenceId: unit.occurrenceId, bodyId: unit.bodyId, bodyRevision: unit.bodyRevision }); }
        }
        await db.collection('readerSources').createIndex({ aliases: 1 }, { unique: true });
        const releaseId = revision('release1', { pilotId: PILOT, entries, profiles: profileSets.map(p => p.id) }); await immutable(db, 'readerReleases', releaseId, { pilotId: PILOT, entries, createdAt: new Date(), profiles: profileSets.map(p => p.id) });
        if (activate) {if(!await lock.findOne({_id:PILOT,token,until:{$gt:new Date()}}))fail('cursor_mismatch',409,'Срок блокировки публикации истёк.'); for (const m of materials) { const current = await loadNative(db, m.nativeRef); const previous = loaded.get(m.id)!; if (current.items.length !== previous.items.length || current.items.some((item: Obj, i: number) => sha(item.raw) !== sha(previous.items[i].raw))) fail('map_revision_mismatch', 409, 'Текст изменился во время публикации.'); } if (rules().datasetRevision !== ds) fail('corpus_unavailable', 503, 'Сборка изменилась во время публикации.'); await db.collection<any>('readerPilots').updateOne({ _id: PILOT }, { $set: { activeRelease: releaseId, activatedAt: new Date() }, $addToSet: { history: releaseId } }, { upsert: true }); }
        return { pilotId: PILOT, releaseId, activated: activate, legacy, sources: entries.map(e => ({ sourceId: e.sourceId, sourceRevision: e.sourceRevision, passportRevision: e.passportRevision })), noTextCopied: true };
    }
    if(!apply)return publication();
    const lock = db.collection<any>('readerLocks'), token = newId('lease'); const now = new Date(); try { const r = await lock.updateOne({ _id: PILOT, $or: [{ until: { $lt: now } }, { until: { $exists: false } }] }, { $set: { until: new Date(Date.now() + 600000), token } }, { upsert: true }); if (!r.matchedCount && !r.upsertedCount) fail('cursor_mismatch', 409, 'Публикация уже выполняется.'); } catch (error) { if ((error as any).code === 11000) fail('cursor_mismatch', 409, 'Публикация уже выполняется.'); throw error; }
    try{return await publication();}finally{await lock.deleteOne({_id:PILOT,token});}
}

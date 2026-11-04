/** Dry-run by default. Canonical lexems are insert-only, including on resume. */
import { MongoClient, ObjectId, BSON, type AnyBulkWriteOperation } from 'mongodb';
import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, createWriteStream } from 'node:fs';
import { resolve, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import { assertCurrent, plain, stable, validatePlanId, type DictionaryImportPlan } from '@/lib/dictionaryImport/plan';
import { digest } from '@/lib/dictionaryImport/core';
import { PROVENANCE_COLLECTIONS, validateProvenance } from '@/lib/dictionaryImport/provenance';
import type { LegacyLexeme } from '@/lib/dictionaryImport/model';

const option=(name:string):string|undefined=>{const i=process.argv.indexOf(name);return i<0?undefined:process.argv[i+1];};
const required=(name:string):string=>{const v=option(name);if(!v||v.startsWith('--'))throw new Error(`Required ${name}`);return v;};
interface SourceDoc {_id:string;payloadHash:string;sourceVersionId:string;payload:Record<string,unknown>}
interface CanonicalDoc { _id:ObjectId; [key:string]:unknown }
interface RunDoc {_id:string;status:string;planId:string;backupDir?:string;backupDirs?:string[];phase?:string;provenanceSha256?:string}
const tables:Record<string,string>={sources:'dictionarySources',entries:'dictionarySourceEntries',locations:'dictionarySourceLocations',
    fragments:'dictionarySourceFragments',grammar:'dictionaryGrammarEvidence',source_references:'dictionaryReferences',
    frequencies:'dictionaryFrequencyEvidence',unresolved_grammar:'dictionaryUnresolvedGrammar'};
const sha=(file:string):string=>createHash('sha256').update(readFileSync(file)).digest('hex');
async function main():Promise<void>{
    const plan=JSON.parse(readFileSync(required('--plan'),'utf8')) as DictionaryImportPlan;validatePlanId(plan);
    if(plan.formatVersion!==1||plan.targetDatabase!=='typikon-csl')throw new Error('Unsupported plan target or version');
    const staging=resolve(required('--staging'));if(sha(staging)!==plan.stagingSha256)throw new Error('Staging checksum mismatch');
    const envName=required('--mongo-uri-env');const uri=process.env[envName];if(!uri)throw new Error(`Environment variable ${envName} is not set`);
    const apply=process.argv.includes('--apply'),resume=process.argv.includes('--resume');
    if(apply&&option('--runtime-capability')!==plan.requiredRuntimeCapability)
        throw new Error('Deploy the required dictionary reader first and explicitly confirm its runtime capability');
    const provenancePath=option('--provenance');
    if(apply&&!provenancePath)throw new Error('Applying requires the reviewed unified provenance artifact');
    const provenanceDb=provenancePath?new Database(resolve(provenancePath),{readonly:true,fileMustExist:true}):undefined;
    const provenanceSha=provenancePath?sha(provenancePath):undefined;
    if(provenanceDb)validateProvenance(provenanceDb,plan);
    if(apply&&option('--provenance-sha256')!==provenanceSha)throw new Error('Confirm the reviewed provenance artifact SHA256 explicitly');
    const client=new MongoClient(uri,{serverSelectionTimeoutMS:10000});
    const stagingDb=new Database(staging,{readonly:true,fileMustExist:true});
    let journalStarted=false;
    try{
        await client.connect();const db=client.db(plan.targetDatabase);
        const lexems=db.collection<CanonicalDoc>('lexems');
        const readCurrent=async():Promise<(LegacyLexeme & {dictionaryImportPlanId?:string})[]>=>
            plain(await lexems.find({}).toArray()) as unknown as (LegacyLexeme & {dictionaryImportPlanId?:string})[];
        const current=await readCurrent();assertCurrent(plan,current);
        const summaries={planId:plan.id,mode:apply?'apply':'dry-run',currentLexemes:current.length,
            plannedInsertions:plan.insertions.length,held:plan.held.length,sourceLinks:plan.links.length,provenanceSha256:provenanceSha??null};
        if(!apply){console.log(JSON.stringify(summaries,null,2));return;}
        const runs=db.collection<RunDoc>('dictionaryImportRuns');const prior=await runs.findOne({_id:plan.id});
        if(prior&&prior.planId!==plan.id)throw new Error('Import journal does not belong to this plan');
        if(prior&&prior.provenanceSha256!==provenanceSha)throw new Error('Import journal uses a different provenance artifact; prepare a new reviewed migration');
        if(prior?.status==='complete'){console.log(JSON.stringify({...summaries,status:'already complete'}));return;}
        if(prior&&!resume)throw new Error('Previous attempt exists; inspect its journal and use --resume explicitly');
        // Back up every affected collection before the first write. Never restore/drop the database.
        const backupDir=resolve(required('--backup-dir'));mkdirSync(backupDir,{recursive:false});
        const collections=['lexems',...Object.values(PROVENANCE_COLLECTIONS),...Object.values(tables),'dictionarySourceLinks','dictionarySourceVersions','dictionaryImportRuns'];
        const backups:{collection:string;file:string;sha256:string}[]=[];
        for(const name of collections){
            const file=join(backupDir,name+'.jsonl.gz');
            const cursor=db.collection(name).find({});
            async function* lines():AsyncGenerator<string>{for await(const row of cursor)yield BSON.EJSON.stringify(row,{relaxed:false})+'\n';}
            await pipeline(Readable.from(lines()),createGzip(),createWriteStream(file,{flags:'wx'}));
            backups.push({collection:name,file,sha256:sha(file)});
        }
        writeFileSync(join(backupDir,'manifest.json'),JSON.stringify({format:'mongo-extended-json-v2',planId:plan.id,sourceVersion:plan.sourceVersion,backups},null,2)+'\n',{flag:'wx'});
        assertCurrent(plan,await readCurrent());
        if(!prior)await runs.insertOne({_id:plan.id,planId:plan.id,status:'running',backupDir,backupDirs:[backupDir],phase:'evidence',provenanceSha256:provenanceSha});
        else await runs.updateOne({_id:plan.id,planId:plan.id},{$set:{status:'running',phase:'evidence'},$addToSet:{backupDirs:backupDir}});
        journalStarted=true;
        const sourceDoc=(table:string,row:Record<string,unknown>):SourceDoc=>{
            const payload={...row};delete payload.rowid;
            if(typeof payload.headers==='string')payload.headers=JSON.parse(payload.headers) as unknown;
            if(typeof payload.subcorpora==='string')payload.subcorpora=JSON.parse(payload.subcorpora) as unknown;
            const id=typeof row.id==='string'?row.id:table==='sources'?`chu-rus:${String(row.code)}`:
                table==='frequencies'?String(row.entryId):digest(stable([table,table==='locations'?plan.sourceVersion:'',payload]));
            return {_id:id,payloadHash:digest(stable(payload)),sourceVersionId:plan.sourceVersion,payload};
        };
        // Every evidence operation uses setOnInsert. Existing editorial fields are never assigned.
        for(const [table,name] of Object.entries(tables)){
            const collection=db.collection<SourceDoc>(name);let last=0;
            const batch=stagingDb.prepare(`SELECT rowid,* FROM ${table} WHERE rowid>? ORDER BY rowid LIMIT 1000`);
            for(;;){const rows=batch.all(last) as Record<string,unknown>[];if(!rows.length)break;
                const ops:AnyBulkWriteOperation<SourceDoc>[]=rows.map(row=>{const doc=sourceDoc(table,row);return {updateOne:{filter:{_id:doc._id},update:{$setOnInsert:doc},upsert:true}};});
                await collection.bulkWrite(ops,{ordered:true});last=Number(rows[rows.length-1].rowid);
            }
            await runs.updateOne({_id:plan.id,planId:plan.id},{$set:{phase:name}});
        }
        const links=db.collection<SourceDoc>('dictionarySourceLinks');
        for(let at=0;at<plan.links.length;at+=1000){
            const ops:AnyBulkWriteOperation<SourceDoc>[]=plan.links.slice(at,at+1000).map(link=>{
                const doc:SourceDoc={_id:digest(stable([plan.sourceVersion,link.externalKey])),payloadHash:digest(stable(link)),sourceVersionId:plan.sourceVersion,payload:{...link}};
                return {updateOne:{filter:{_id:doc._id},update:{$setOnInsert:doc},upsert:true}};
            });await links.bulkWrite(ops,{ordered:true});
        }
        const metadata=Object.fromEntries((stagingDb.prepare('SELECT key,value FROM metadata').all() as {key:string;value:string}[]).map(r=>[r.key,r.value]));
        const version:SourceDoc={_id:plan.sourceVersion,payloadHash:plan.sourceVersion,sourceVersionId:plan.sourceVersion,
            payload:{sourceFileSha256:plan.sourceVersion,dslHeaders:JSON.parse(metadata.dslHeaders??'[]') as unknown,defaultIzvod:metadata.defaultIzvod??'russian-synodal'}};
        await db.collection<SourceDoc>('dictionarySourceVersions').updateOne({_id:version._id},{$setOnInsert:version}, {upsert:true});
        // Sidecar graph is insert-only too. IDs do not depend on mutable article contents.
        if(provenanceDb)for(const [table,name] of Object.entries(PROVENANCE_COLLECTIONS)){
            const collection=db.collection<SourceDoc>(name);let last=0;
            const query=provenanceDb.prepare(`SELECT rowid,id,payload FROM ${table} WHERE rowid>? ORDER BY rowid LIMIT 1000`);
            for(;;){const rows=query.all(last) as {rowid:number;id:string;payload:string}[];if(!rows.length)break;
                const docs=rows.map(row=>({_id:row.id,payloadHash:digest(stable(JSON.parse(row.payload))),sourceVersionId:provenanceSha!,payload:JSON.parse(row.payload) as Record<string,unknown>}));
                const existing=await collection.find({_id:{$in:docs.map(d=>d._id)}}).toArray();
                const expected=new Map(docs.map(d=>[d._id,d.payloadHash]));
                if(existing.some(d=>d.payloadHash!==expected.get(d._id)))throw new Error(`Provenance ID conflict in ${name}; preserve local data and rebuild the plan`);
                await collection.bulkWrite(docs.map(doc=>({updateOne:{filter:{_id:doc._id},update:{$setOnInsert:doc},upsert:true}})),{ordered:true});
                last=rows[rows.length-1].rowid;
            }
            await runs.updateOne({_id:plan.id,planId:plan.id},{$set:{phase:name}});
        }
        // Recheck immediately before canonical insertion; external edits require a fresh plan.
        const beforeInsert=await readCurrent();assertCurrent(plan,beforeInsert);
        const present=new Set(beforeInsert.map(r=>r._id));
        const missing=plan.insertions.filter(r=>!present.has(r._id));
        if(missing.length)await lexems.insertMany(missing.map(r=>({...r,_id:new ObjectId(r._id),dictionaryImportPlanId:plan.id})),{ordered:true});
        assertCurrent(plan,await readCurrent());
        await runs.updateOne({_id:plan.id,planId:plan.id},{$set:{status:'complete',phase:'complete'}});
        console.log(JSON.stringify({...summaries,status:'complete',inserted:missing.length,existingLexemesModified:0,backupDir},null,2));
    }catch(error){
        // Keep the backup and journal. Never delete rows as an automatic rollback.
        if(journalStarted){
            try{await client.db(plan.targetDatabase).collection<RunDoc>('dictionaryImportRuns').updateOne({_id:plan.id,planId:plan.id},{$set:{status:'failed'}});}catch{/* The original error is authoritative. */}
        }
        throw error;
    }finally{stagingDb.close();provenanceDb?.close();await client.close();}
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Import failed');process.exitCode=1;});

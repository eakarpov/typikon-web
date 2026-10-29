import { extractTrainingSegments } from "../lib/kruczie/corpus/extract";
import { trainNgramModel } from "../lib/kruczie/corpus/train";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import type { ChantCollection, ChantWitness, CorpusSample, ChantWork } from "../lib/kruczie/corpus/types";
async function main() {
    const root = join(process.cwd(), "data/chant-corpus/znamen-v1"), manifest = JSON.parse(await readFile(join(root,"manifest.json"),"utf8"));
    const { parseZnamen } = await import("@znamenica/kruczie/formats/znamen");
    const witnesses: ChantWitness[] = [], works = new Map<string,ChantWork>(), samples: CorpusSample[] = [], rejected: { witnessId: string; block: number; reason: string }[] = [];
    const parent = new Map<string,string>();
    const find = (id: string): string => { const previous=parent.get(id);if(!previous){parent.set(id,id);return id;}if(previous===id)return id;const root=find(previous);parent.set(id,root);return root; };
    for (const record of manifest.records) {
        const aliases: string[] = record.chantAliases?.length ? record.chantAliases : [record.chantId];
        for (const alias of aliases) {const a=find(aliases[0]),b=find(alias);if(a!==b)parent.set(a<b?b:a,a<b?a:b);}
    }
    let rejectedPositions = 0, recoveredBlocks = 0, recoveredPositions = 0;
    const toneConflicts: {witnessId:string;header:number;code:number}[] = [];
    for (const [recordIndex, record] of manifest.records.entries()) {
        if (recordIndex % 200 === 0) console.log(`Проверено записей: ${recordIndex}/${manifest.records.length}`);
        if (record.notationKind !== "double") continue;
        const raw = await readFile(join(root,record.rawPath),"utf8");
        if (createHash("sha256").update(raw).digest("hex") !== record.sha256) throw new Error(`Checksum mismatch: ${record.id}`);
        const file = parseZnamen(raw).value;
        if (!file || !file.blocks.some(b => b.notation !== undefined && b.melody !== undefined)) continue;
        const canonical=find(record.chantId), workId = `znamen:${canonical}`;
        works.set(workId, { id: workId, canonicalCode: canonical, genre: record.genre, aliases: [...parent.keys()].filter(code=>find(code)===canonical) });
        const codeTone = /^w([1-8])[0-6][a-z]/u.exec(record.chantId);
        const conflict = record.toneEvidence === "source-header" && codeTone && record.tone !== Number(codeTone[1]);
        if (conflict) toneConflicts.push({witnessId:record.id,header:record.tone,code:Number(codeTone![1])});
        witnesses.push({ id: record.id, workId, sourceId: record.sourceId, tradition: record.tradition, notationKind: "double", ...(!conflict && record.tone ? { tone: record.tone } : {}), toneEvidence: conflict ? "conflicting-header-and-code" : record.toneEvidence, url: record.url,
            rawPath: record.rawPath, sha256: record.sha256, attribution: record.transcription, rightsUrl: record.rightsUrl });
        const extracted = await extractTrainingSegments(file, record.id);
        samples.push(...extracted.samples); rejected.push(...extracted.rejected);
        rejectedPositions += extracted.rejectedPositions;
        recoveredBlocks += extracted.recoveredBlocks; recoveredPositions += extracted.recoveredPositions;
    }
    const corpus: ChantCollection = { schemaVersion:1, version:"znamen-2026-10-29-v3", works:[...works.values()], witnesses, sources:[...new Set(witnesses.map(w=>w.sourceId))].sort().map(id=>({id,title:manifest.sourceTitles?.[id] ?? id})), samples,
        audit: { rejectedBlocks:rejected.length - recoveredBlocks, rejectedPositions, doubleWitnesses:witnesses.length, discoveryErrors:manifest.errors.length, scope:manifest.scope } };
    await writeFile(join(process.cwd(),"data/chant-corpus/znamen-v1/collection.json"),JSON.stringify(corpus)+"\n");
    await writeFile(join(process.cwd(),"src/data/kruczie-corpus-metadata.json"),JSON.stringify({ version:corpus.version,sources:corpus.sources,witnessCount:corpus.witnesses.length,workCount:corpus.works.length,rejectedBlocks:corpus.audit.rejectedBlocks,toneUnknownCount:witnesses.filter(w=>w.tone===undefined).length,recoveredBlocks,recoveredPositions,opaquePositions:samples.reduce((n,s)=>n+s.positions.filter(p=>p.opaque).length,0) })+"\n");
    const model = await trainNgramModel(corpus);
    const { createNgramIndex } = await import("@znamenica/kruczie/ngrams"); createNgramIndex(model);
    await writeFile(join(process.cwd(),"../kruczie-npm/src/ngrams/model.json"),JSON.stringify(model)+"\n");
    await writeFile(join(root,"quality-report.json"),JSON.stringify({ ...corpus.audit, problemBlocks: rejected.length, recoveredBlocks, recoveredPositions, opaquePositions:samples.reduce((n,s)=>n+s.positions.filter(p=>p.opaque).length,0), toneConflicts, samples:samples.length, positions:samples.reduce((n,s)=>n+s.positions.length,0), rejected },null,2)+"\n");
    console.log(JSON.stringify({ witnesses:witnesses.length, works:works.size, sources:corpus.sources.length, samples:samples.length, rejected:rejected.length }));
}
main().catch(error=>{ console.error(error);process.exitCode=1; });

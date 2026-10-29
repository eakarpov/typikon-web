import { test } from "node:test";
import assert from "node:assert/strict";
import { loadParallelWork } from "./parallelServer";
import { rankWholeWork } from "./workRanking";
import { inspectWork, type WorkResult } from "./work";
import { builtinCorpusIndex } from "./corpus/builtin";
import { getCorpusRealizations } from "./corpus";
import { alignParallels } from "./parallelAlignment";
const context={direction:"to-notes" as const,tradition:"znamenny" as const,tone:2 as const};
test("w20g1: два действительных двоезнаменника доступны с адресами и проверенными позициями",async()=>{
    const work=await loadParallelWork("w20g1");
    assert.deepEqual(work.witnesses.map(w=>w.sourceId),["5169","q333"]);
    assert.ok(work.witnesses.every(w=>w.groups.length>60&&w.tone===2&&w.url&&w.sha256));
    assert.ok(!work.witnesses.find(w=>w.sourceId==="q333")!.groups.some(g=>g.text.includes("спо")));
    assert.equal((await loadParallelWork("unknown-public-code")).witnesses.length,0);
    await assert.rejects(()=>loadParallelWork("../manifest"));
});
test("общее ранжирование восстанавливает известную запись через границу физических строк",async()=>{
    const work=await loadParallelWork("w20g1"),reference=work.witnesses.find(w=>w.sourceId==="5169")!,groups=reference.groups.slice(0,12);
    const raw="%код w20g1\n"+[groups.slice(0,6),groups.slice(6)].map(row=>`%з ${row.map(g=>g.neumes).join(" ")}\n%т ${row.map(g=>g.text||"_").join("-")}\n`).join("\n");
    const view=await inspectWork(raw),index=await builtinCorpusIndex();
    assert.ok(view.file.blocks.every(b=>b.aligned));
    const input:Record<number,WorkResult>={};
    for(const [block,row] of view.blocks.entries())input[block]={blockIndex:block,status:"untranslated",candidates:[],diagnostics:[],truncated:false,positions:row.cells.map((c,i)=>({index:i,notes:getCorpusRealizations(index,c.syllable.notation!.raw,context),melodies:[]}))};
    const before=JSON.stringify({view,input}),ranked=await rankWholeWork(view,input,context,work);
    const {melodyKey}=await import("@znamenica/kruczie");
    assert.deepEqual(Object.values(ranked).flatMap(r=>r.recommendation!.notes.map(n=>n?melodyKey(n):null)),groups.map(g=>melodyKey(g.notes)));
    assert.equal(ranked[0].recommendation!.ranking.preference!.reference!.sourceId,"5169");
    assert.equal(ranked[0].recommendation!.ranking.preference!.reference!.matched,12);
    assert.equal(JSON.stringify({view,input}),before);
    const target=view.blocks.flatMap((r,block)=>r.cells.map((c,position)=>({block,position,neumes:c.syllable.notation!.raw,text:c.syllable.text.raw})));
    assert.deepEqual(await alignParallels(view,target,work,{...context,tone:1}),[]);
    assert.deepEqual(await alignParallels(view,target,work,{...context,corpusSourceId:"missing"}),[]);
});


test("параллель даёт беспометный вариант с происхождением, но не отменяет заданные высоты", async () => {
    const view = await inspectWork("%код example\n%з Т мп_:/ пв=:`\n%т а-б-в\n");
    const index = await builtinCorpusIndex();
    const parallel = {
        version: index.model.version, code: "example", witnesses: [{
            id: "fixture", workId: "example", sourceId: "fixture", url: "https://example.com/fixture", sha256: "fixture",
            tradition: "znamenny" as const, tone: 2 as const,
            groups: ["мТ", "п_:/", "п=:`"].map((neumes, position) => ({
                neumes, notes: ["*в1*п1*м1", "п1", "с1"][position], text: ["а", "б", "в"][position],
                block: 0, position, ordinal: position, segment: 0,
            })),
        }],
    };
    const input: Record<number, WorkResult> = {0: {blockIndex: 0, status: "untranslated", candidates: [], diagnostics: [{code:"MUSICAL_GAPS",severity:"warning",message:"fixture",details:{positions:[0,1,2]}}], truncated: false}};
    const ranked = await rankWholeWork(view, input, context, parallel);
    assert.equal(ranked[0].recommendation!.notes[0], "*в1*п1*м1");
    assert.deepEqual(ranked[0].recommendation!.notes.slice(1), [null, null]);
    assert.equal(ranked[0].recommendation!.ranking.parallels![0].match, "text-family");
    assert.equal(ranked[0].recommendation!.ranking.parallels![0].sourceNeumes, "мТ");
    assert.deepEqual(ranked[0].diagnostics.find(d=>d.code==="MUSICAL_GAPS")!.details!.positions,[1,2]);
    assert.equal(input[0].recommendation, undefined);
    assert.equal(view.blocks[0].cells[1].syllable.notation!.raw, "мп_:/");
});

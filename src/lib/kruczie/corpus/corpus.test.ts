import { test } from "node:test";
import assert from "node:assert/strict";
import { createCorpusIndex, getCorpusRealizations, scoreCorpusSequence, suggestCorpusSequences, rankCorpusSequences, type ChantCollection, type ChantWitness } from "./index";
function collection(rows: { id: string; source: string; tone: number; notes: string[]; kind?: ChantWitness["notationKind"] }[]): ChantCollection {
    return { schemaVersion:1, version:"test", sources:[], works:rows.map(r=>({id:r.id,canonicalCode:r.id,genre:"sticheron"})), witnesses:rows.map(r=>({id:r.id,workId:r.id,sourceId:r.source,tradition:"znamenny",notationKind:r.kind??"double",tone:r.tone as 1,toneEvidence:"fixture",url:`https://example.com/${r.id}`,rawPath:r.id,sha256:r.id,attribution:"test",rightsUrl:"https://example.com/rights"})),
        samples:rows.map(r=>({witnessId:r.id,block:0,positions:r.notes.map((notes,i)=>({position:i,neumes:["гТ","нТ","сТ"][i],notes,text:`${r.id.replace(/[0-9]/gu,"")}-${i}`}))})),
        audit:{rejectedBlocks:0,rejectedPositions:0,doubleWitnesses:rows.length,discoveryErrors:0,scope:"test"} };
}
const context = { tradition:"znamenny" as const, tone:2 as const };
test("пары и тройки ранжируют конкретный нотный развод с источниками доказательств", async()=>{
    const data=collection([{id:"a1",source:"A",tone:2,notes:["г1","н1","с1"]},{id:"b1",source:"B",tone:2,notes:["г1","н1","с1"]},{id:"c1",source:"A",tone:2,notes:["г1","с1","с1"]}]);
    const before=JSON.stringify(data), index=await createCorpusIndex(data);
    const result=suggestCorpusSequences(index,[{neumes:"гТ",options:["г1"]},{neumes:"нТ",options:["с1","н1"]},{neumes:"сТ",options:["с1"]}],context);
    assert.equal(result.sequences[0].groups[1].notes,"н1");
    const triple=result.sequences[0].ranking.evidence.find(e=>e.order===3)!;
    assert.equal(triple.count,2);assert.equal(triple.total,3);assert.deepEqual(triple.sourceIds,["A","B"]);assert.equal(triple.chantCount,2);
    assert.ok(triple.examples[0].url);assert.equal(JSON.stringify(data),before);
});
test("глас и источник ограничивают подсчёт, неизвестный контекст не подмешивается",async()=>{
    const index=await createCorpusIndex(collection([{id:"a",source:"A",tone:2,notes:["г1","н1"]},{id:"b",source:"B",tone:2,notes:["г1","с1"]},{id:"c",source:"B",tone:1,notes:["г1","м1"]}]));
    assert.deepEqual(getCorpusRealizations(index,"нТ",{...context,sourceId:"A"}),["н1"]);
    assert.deepEqual(getCorpusRealizations(index,"нТ",{...context,sourceId:"B"}),["с1"]);
    assert.deepEqual(getCorpusRealizations(index,"нТ",{...context,tone:1}),["м1"]);
    assert.deepEqual(getCorpusRealizations(index,"нТ",{...context,sourceId:"missing"}),[]);
});
test("копии полной записи из другого источника не увеличивают частоту",async()=>{
    const data=collection([{id:"copy1",source:"A",tone:2,notes:["г1","н1"]},{id:"copy2",source:"B",tone:2,notes:["г1","н1"]}]);
    const index=await createCorpusIndex(data), ranking=scoreCorpusSequence(index,[{neumes:"гТ",notes:"г1"},{neumes:"нТ",notes:"н1"}],context);
    assert.equal(ranking.evidence.find(e=>e.order===2)!.count,1);
    assert.deepEqual(ranking.evidence.find(e=>e.order===2)!.sourceIds,["A","B"]);
    assert.equal(scoreCorpusSequence(index,[{neumes:"гТ",notes:"г1"},{neumes:"нТ",notes:"н1"}],{...context,sourceId:"B"}).evidence.find(e=>e.order===2)!.count,1);
});
test("однослойные записи не обучают корпус и пропуски не склеивают соседей",async()=>{
    const index=await createCorpusIndex(collection([{id:"a",source:"A",tone:2,notes:["г1","н1","с1"]},{id:"b",source:"A",tone:2,notes:["м1","п1"],kind:"notes"}]));
    assert.deepEqual(getCorpusRealizations(index,"гТ",context),["г1"]);
    const result=suggestCorpusSequences(index,[{neumes:"гТ",options:["г1"]},{neumes:"нТ",options:[]},{neumes:"сТ",options:["с1"]}],context);
    assert.equal(result.sequences[0].groups[1].notes,null);
    assert.ok(result.sequences[0].ranking.evidence.every(e=>e.order===1));
});
test("нет оснований — исходный порядок сохраняется; ограниченный поиск сообщается явно",async()=>{
    const index=await createCorpusIndex(collection([]));
    const candidates=[[{neumes:"гТ",notes:"н1"}],[{neumes:"гТ",notes:"г1"}]];
    assert.deepEqual(rankCorpusSequences(index,candidates,context).map(v=>v.groups),candidates);
    assert.equal(suggestCorpusSequences(index,[{neumes:"гТ",options:["н1","г1"]}],context,1).truncated,true);
    assert.throws(()=>suggestCorpusSequences(index,[],context,0));
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { createCorpusIndex, suggestCorpusSequences } from "./corpus";
import { searchCoherentSequences } from "./sequenceRanking";
import type { ChantCollection } from "./corpus/types";
import type { AlignedParallel } from "./parallelAlignment";
const context={tradition:"znamenny" as const,tone:2 as const};
async function index(rows:{neumes:string[];notes:string[]}[]) {
    const data:ChantCollection={schemaVersion:1,version:"fixture",sources:[],works:[],witnesses:rows.map((_,i)=>({id:String(i),workId:String(i),sourceId:"S",tradition:"znamenny",notationKind:"double",tone:2,toneEvidence:"test",url:`https://example.com/${i}`,rawPath:"test",sha256:"test",attribution:"test",rightsUrl:"https://example.com"})),samples:rows.map((r,i)=>({witnessId:String(i),block:0,positions:r.neumes.map((neumes,j)=>({neumes,notes:r.notes[j],text:String(i),position:j}))})),audit:{rejectedBlocks:0,rejectedPositions:0,doubleWitnesses:rows.length,discoveryErrors:0,scope:"fixture"}};
    return createCorpusIndex(data);
}
test("наблюдаемая тройка приоритетнее очень частых одиночных вариантов",async()=>{
    const corpus=await index([{neumes:["гТ","нТ","сТ"],notes:["г1","н1","с1"]},...Array.from({length:200},()=>({neumes:["нТ"],notes:["*в1"]}))]);
    const result=suggestCorpusSequences(corpus,[{neumes:"гТ",options:["г1"]},{neumes:"нТ",options:["*в1","н1"]},{neumes:"сТ",options:["с1"]}],context);
    assert.equal(result.sequences[0].groups[1].notes,"н1");assert.ok(result.sequences[0].ranking.preference!.orders.triples);
});
test("плавность действует на неподтверждённый стык, а наблюдаемый скачок сохраняется",async()=>{
    const positions=[{neumes:"гТ",options:["г1"]},{neumes:"нТ",options:["*в1","н1"]}];
    const singles=await index([{neumes:["гТ"],notes:["г1"]},{neumes:["нТ"],notes:["н1"]},...Array.from({length:20},()=>({neumes:["нТ"],notes:["*в1"]}))]);
    assert.equal(suggestCorpusSequences(singles,positions,context).sequences[0].groups[1].notes,"н1");
    const observed=await index([{neumes:["гТ","нТ"],notes:["г1","*в1"]},{neumes:["нТ"],notes:["н1"]}]);
    assert.equal(suggestCorpusSequences(observed,positions,context).sequences[0].groups[1].notes,"*в1");
    assert.equal(suggestCorpusSequences(observed,positions,context).sequences[0].ranking.preference!.unsupportedJoinCost,0);
});
test("целая последовательность одного параллельного свидетеля приоритетнее чужой частоты",async()=>{
    const neumes=["гТ","нТ","сТ"],notes=["г1","н1","с1"];
    const corpus=await index([{neumes,notes},...Array.from({length:20},()=>({neumes,notes:["г1","м1","с1"]}))]);
    const witness={id:"parallel",workId:"work",sourceId:"S",url:"https://example.com/parallel",sha256:"test",tradition:"znamenny" as const,tone:2 as const,groups:neumes.map((n,i)=>({neumes:n,notes:notes[i],text:"",block:0,position:i,ordinal:i,segment:0}))};
    const aligned:AlignedParallel={witness,mapping:new Map(witness.groups.map((g,i)=>[i,g])),score:10};
    const positions=neumes.map((n,i)=>({neumes:n,options:i===1?["м1","н1"]:[notes[i]]}));
    assert.equal(searchCoherentSequences(corpus,positions,context).sequences[0].groups[1].notes,"м1");
    assert.equal(searchCoherentSequences(corpus,positions,context,64,[aligned]).sequences[0].groups[1].notes,"н1");
});
test("пропуск и черта разрывают контекст; неизвестному крюку ноты не сочиняются",async()=>{
    const corpus=await index([{neumes:["гТ","нТ"],notes:["г1","н1"]}]);
    const result=suggestCorpusSequences(corpus,[{neumes:"гТ",options:["г1"]},{neumes:"мп_:/",options:[]},{neumes:"нТ",options:["н1"]}],context);
    assert.equal(result.sequences[0].groups[1].notes,null);assert.ok(result.sequences[0].ranking.evidence.every(e=>e.order===1));
    const ended=suggestCorpusSequences(corpus,[{neumes:"гТ",options:["г1\\"]},{neumes:"нТ",options:["н1"]}],context).sequences[0].ranking;
    assert.equal(ended.preference!.unsupportedJoinCost,0);
    assert.ok(ended.evidence.every(e=>e.order===1));
});

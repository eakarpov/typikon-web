import { guessSex } from "./names";
import { test } from "node:test";
import assert from "node:assert/strict";
import { supplementalPersonalLexeme, femininePersonalLexeme, applyManualCases, cleanManualCase, personalCaseForm } from "./nameForms";
import { decline } from "@/lib/morphology/decline";
import { withInitialBreathing } from "./breathing";
import { renderNamedPrayer } from "@/lib/molitvoslov/named";
import { backupPerson } from "./backup";

test("Дария and Дарья have a feminine paradigm independent of Дарий", () => {
    for (const name of ["Дария", "Дарья", "Да́рия"]) {
        const p = decline(supplementalPersonalLexeme(name)!);
        assert.equal(p?.sgGen[0], "да́ріи");
        assert.equal(p?.sgDat[0], "да́ріи");
    }
});
test("female monastic forms use feminine endings, not the masculine genitive", () => {
    for (const [name, lemma, key, genitive] of [
        ["Серафима", "серафі́мъ", "серафим", "серафі́мы"],
        ["Михаила", "міхаи́лъ", "михаил", "міхаи́лы"],
        ["Иоанна", "іѡа́ннъ", "иоанн", "іѡа́нны"],
        ["Сергия", "се́ргій", "сергий", "се́ргіи"],
    ]) {
        const female = femininePersonalLexeme(name, {name: lemma, search: key, properties: "S,m,anim,persn"});
        assert.ok(female, name);
        const p = decline(female!);
        assert.equal(p?.sgGen[0], genitive, name);
        assert.ok(p?.sgDat[0], name);
    }
    assert.equal(femininePersonalLexeme("Анна", {name: "іѡа́ннъ", search: "иоанн", properties: "S,m,anim,persn"}), null);
});
test("manual cases are person-specific fallbacks and do not override recognized paradigms", async () => {
    const base = {text: "Луна", genitive: "Луна", source: "plain" as const};
    const manual = await applyManualCases({manualGenitive: "Луны", manualDative: "Луне"}, base, async s => s);
    assert.equal(manual.genitive, "Луны"); assert.equal(manual.dative, "Луне");
    assert.equal(manual.source, "manual"); assert.equal(manual.hasParadigm, false);
    assert.equal((await applyManualCases({}, base, async s => s)).genitive, "Луна");
    assert.equal((await applyManualCases({manualGenitive: "wrong"}, {...base, genitive:"Луны",source:"lexicon"},async s=>s)).genitive, "Луны");
});
test("reading prayers keep each suffix attached to its name", () => {
    const text = renderNamedPrayer("Помяни имярек.", [
        {name:"Анны",commemorationSuffix:"kinsfolk"},
        {name:"Марии",commemorationSuffix:"child"},
        {name:"Елены",commemorationSuffix:"children"},
        {name:"Николая"},
    ], "m");
    assert.equal(text,"Помяни Анны со сро́дники, Марии со ча́домъ, Елены со ча́ды, Николая.");
});
test("Church Slavonic name normalization preserves stress and existing breathing", () => {
    for (const [raw, expected] of [["Екатери́ны","Є҆катери́ны"],["ніки́ты","нїки́ты"],["мела́ніи","мела́нїи"],["діонѵ́сіи","дїонѵ́сїи"],["і҆ѡа́нны","і҆ѡа́нны"],["і́и","і҆́и"],["Аѵгꙋсти́ны","А҆ѷгꙋсти́ны"]]) {
        assert.equal(withInitialBreathing(raw), expected);
        assert.equal(withInitialBreathing(expected),expected);
    }
});
test("manual forms survive backup and reject invalid values", () => {
    const copy = backupPerson({name:"Луна",kind:"living",manualGenitive:"Луны",manualDative:"Луне"});
    assert.equal(copy.manualGenitive,"Луны"); assert.equal(copy.manualDative,"Луне");
    assert.equal(cleanManualCase("  Луны  "),"Луны");
    assert.throws(()=>cleanManualCase("x".repeat(61)));
    assert.throws(()=>cleanManualCase({}));
});

test("Космы retains its terminal heavy stress after declension", () => {
    assert.equal(guessSex("Косма"),"m");
    const p = decline({name:"косма́",scheme:"N3t",properties:"S,m,anim,persn"})!;
    assert.equal(personalCaseForm("косма́",p.sgGen[0]),"космы̀");
    assert.equal(personalCaseForm("косма́","космы̀"),"космы̀");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeForSearch, saintMatches, searchTerms } from "@/lib/saintSearch";

const saint = (name: string, altNames: string[] = []) => ({ name, altNames });

test("ударение не мешает найти: набирают без него, а в каталоге оно есть", () => {
    // «й» здесь намеренно становится «и»: краткая — такой же надстрочный знак, как
    // ударение, и снимается вместе с ним. Запрос проходит ту же нормализацию.
    assert.equal(normalizeForSearch("Феофа́но Византи́йская"), "феофано византииская");
    assert.ok(saintMatches(saint("Феофа́но Византи́йская"), searchTerms("феофано")));
});

test("дореформенные буквы кладутся на современные", () => {
    assert.ok(saintMatches(saint("Варлаа́мъ"), searchTerms("варлаам")));
    assert.ok(saintMatches(saint("Хрісті́на"), searchTerms("христина")));
});

test("ищется и по альтернативным именам — ради них они и собраны", () => {
    const bogorodica = saint("Богородица", ["Богоматерь", "Дева Мария", "Мари́я Богоро́дица"]);
    assert.ok(saintMatches(bogorodica, searchTerms("дева мария")));
    assert.ok(saintMatches(bogorodica, searchTerms("богоматерь")));
});

test("слова соединяются по И: «иоанн злат» не должно давать всех Иоаннов", () => {
    const zlatoust = saint("Иоа́нн Златоу́ст");
    const lestvichnik = saint("Иоа́нн Ле́ствичник");
    assert.ok(saintMatches(zlatoust, searchTerms("иоанн злат")));
    assert.equal(saintMatches(lestvichnik, searchTerms("иоанн злат")), false);
});

test("слова могут стоять в разных именах одного святого", () => {
    const varlaam = saint("Варлаа́м Ху́тынский", ["Але́кса", "Михалевич"]);
    assert.ok(saintMatches(varlaam, searchTerms("хутынский алекса")));
});

test("пустой запрос никого не отсеивает", () => {
    assert.deepEqual(searchTerms("   "), []);
    assert.ok(saintMatches(saint("кто угодно"), searchTerms("")));
});

test("ё и е не различаются", () => {
    assert.ok(saintMatches(saint("Фёдор"), searchTerms("федор")));
});

test("и и й не различаются — набирают и так, и так", () => {
    assert.ok(saintMatches(saint("Византи́йская"), searchTerms("византийская")));
    assert.ok(saintMatches(saint("Византи́йская"), searchTerms("византиискаа".slice(0, 11))));
});

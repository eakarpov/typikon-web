import { test } from "node:test";
import assert from "node:assert/strict";
import { articleTarget, parseArticle, resolveLinks } from "@/scripts/lib/bean";

const AVANA = `{{БЭАН
| КАЧЕСТВО = 3
| ВИКИПЕДИЯ = Барада
| ЭСБЕ =
}}

'''Авана''' (IV Цар. {{Библия|4Цар|5:12|т=V, 12}}) — название реки в Сирии. ''Разве Авана и Фарфар, реки Дамасские, не лучше?'' См. '''[[БЭАН/Фарфар|Фарфар]]'''. {{ifloat|0|Авана (БЭАН).png|title='''Река Авана'''}}
Надпись {{lang|grc|απολλωνος}}, цена {{дробь|21|1|2}} коп.

[[Категория:БЭАН:Статьи без категорий]]`;

test("статья: шапка, жирный и курсив, Писание как напечатано, ссылка на статью, картинка выброшена", () => {
    const parsed = parseArticle("БЭАН/Авана", AVANA);
    assert.equal(parsed.kind, "article");
    if (parsed.kind !== "article") return;
    assert.equal(parsed.name, "Авана");
    assert.equal(parsed.headword, "Авана");
    assert.equal(parsed.wikipedia, "Барада");
    assert.equal(parsed.quality, "3");
    assert.deepEqual(parsed.bibleRefs, [{ book: "4Цар", chapter: 5, verse: 12, ref: "5:12" }]);
    assert.deepEqual(parsed.links, ["Фарфар"]);
    assert.deepEqual(parsed.unknownTemplates, []);
    assert.equal(parsed.content,
        "**Авана** (IV Цар. V, 12) — название реки в Сирии. *Разве Авана и Фарфар, реки Дамасские, не лучше?* "
        + "См. **{t|@@Фарфар@@|Фарфар}**.\nНадпись απολλωνος, цена 21 1/2 коп.");
});

test("вложенный шаблон: опечатка внутри ссылки на Писание", () => {
    const parsed = parseArticle("БЭАН/Агарь", "'''Агарь''' (Быт. {{Библия|Быт|16:7|т={{опечатка|XXVI|XVI|О1|nocat=}}, 7}}).");
    assert.equal(parsed.kind === "article" && parsed.content, "**Агарь** (Быт. XVI, 7).");
});

test("перенаправление, неоднозначность, незнакомый шаблон", () => {
    assert.deepEqual(parseArticle("БЭАН/Август-Кесарь", "#перенаправление [[БЭАН/Август-кесарь]]"),
        { kind: "redirect", title: "БЭАН/Август-Кесарь", target: "Август-кесарь" });

    const dis = parseArticle("БЭАН/Авдон", "* [[БЭАН/Авдон (город)]]\n* [[БЭАН/Авдон (сын Гиллела)]]\n\n{{неоднозначность}}{{нечто|x}}");
    assert.equal(dis.kind, "article");
    if (dis.kind !== "article") return;
    assert.equal(dis.disambiguation, true);
    assert.deepEqual(dis.links, ["Авдон (город)", "Авдон (сын Гиллела)"]);
    assert.deepEqual(dis.unknownTemplates, ["нечто"]);
    assert.equal(dis.content, "* {t|@@Авдон (город)@@|Авдон (город)}\n* {t|@@Авдон (сын Гиллела)@@|Авдон (сын Гиллела)}");
});

test("цели ссылок: префикс и относительный путь; прочее — не статья", () => {
    assert.equal(articleTarget("БЭАН/Ефиопия"), "Ефиопия");
    assert.equal(articleTarget("../Вааса"), "Вааса");
    assert.equal(articleTarget("w:Недотрога"), null);
    assert.equal(parseArticle("БЭАН/X", "[[4Цар.#17:1|XVII, 1]] и [[Гиппократ]]").kind === "article"
        && (parseArticle("БЭАН/X", "[[4Цар.#17:1|XVII, 1]] и [[Гиппократ]]") as any).content, "XVII, 1 и Гиппократ");
});

test("подстановка алиасов: найденная статья — ссылка, отсутствующая — подпись", () => {
    const aliases: Record<string, string> = { "Фарфар": "nikifor-farfar" };
    const { content, unresolved } = resolveLinks(
        "См. {t|@@Фарфар@@|Фарфар} и {t|@@Нет такой@@|другую}.",
        (a) => aliases[a],
    );
    assert.equal(content, "См. {t|nikifor-farfar|Фарфар} и другую.");
    assert.deepEqual(unresolved, ["Нет такой"]);
});

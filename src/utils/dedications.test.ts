import { test } from "node:test";
import assert from "node:assert/strict";
import { DEDICATIONS, DEDICATION_STEMS, matchDedication, matchDedications, normalizeTempleName } from "@/utils/dedications";

const slugOf = (name: string) => matchDedication(name)?.dedication.slug ?? null;

test("посвящение читается и из родительного падежа, и из прилагательного", () => {
    // Двоякость названия — главная причина, по которой словарь вообще нужен.
    assert.equal(slugOf("Церковь Николая Чудотворца"), "nikolay-chudotvorec");
    assert.equal(slugOf("Никольская церковь"), "nikolay-chudotvorec");
    assert.equal(slugOf("Спасо-Преображенский собор"), "preobrazhenie");
    assert.equal(slugOf("Церковь Преображения Господня"), "preobrazhenie");
});

test("уточнение в скобках не участвует в разборе", () => {
    // Иначе город из скобок читался бы наравне с именем святого:
    // «(Никольское)» сделало бы Никольским любой храм этого села.
    assert.equal(slugOf("Церковь Илии Пророка (Никольское)"), "ilia-prorok");
    assert.equal(normalizeTempleName("Собор (Санкт-Петербург)"), "собор");
});

test("запятая внутри имени не рвёт образец", () => {
    // Строка «Алексия, человека Божия» — то же посвящение, что и без запятой.
    assert.equal(slugOf("Церковь Алексия, человека Божия"), "aleksiy-chelovek-bozhiy");
    assert.equal(slugOf("Церковь Софии, Премудрости Божией"), "sofia-premudrost");
});

test("образец без латиницы не полагается на границу слова", () => {
    // \b в JavaScript считает словом только латиницу: между «спаса» и пробелом
    // границы для него нет. Образец /спаса\b/ не совпадал НИ РАЗУ, и все
    // Спасские храмы уходили в неразобранные.
    assert.equal(slugOf("Церковь Спаса на Ильине улице"), "spassky-obshiy");
    assert.equal(slugOf("Спасская церковь"), "spassky-obshiy");
});

test("частное посвящение побеждает общее", () => {
    // Порядок словаря значим: «Рождества Богородицы» должно взять верх над
    // Рождеством Христовым, а «Спаса Нерукотворного» — над общим Спасом.
    assert.equal(slugOf("Церковь Рождества Пресвятой Богородицы"), "rozhdestvo-bogorodicy");
    assert.equal(slugOf("Церковь Рождества Христова"), "rozhdestvo-hristovo");
    assert.equal(slugOf("Церковь Спаса Нерукотворного Образа"), "spas-nerukotvorny");
});

test("точный образец всего словаря побеждает короткую основу", () => {
    // Ради этого основы вынесены во второй ярус. Будь «троиц» образцом внутри
    // своей записи, храм Рождества Богородицы в Троице-Сергиевой лавре
    // разобрался бы как Троицкий.
    assert.equal(slugOf("Церковь Рождества Богородицы Троице-Сергиевой лавры"), "rozhdestvo-bogorodicy");
    assert.equal(slugOf("Троице-Измайловский собор"), "troica");
});

test("инославный храм остаётся без посвящения", () => {
    // Признак стоит то при общине («кирха»), то в самом посвящении
    // («Непорочное Зачатие»), и разбирать такие названия нашим словарём нельзя.
    assert.equal(slugOf("Лютеранская церковь Святой Марии"), null);
    assert.equal(slugOf("Храм Непорочного Зачатия Пресвятой Девы Марии"), null);
    assert.equal(slugOf("Базилика Святого Амвросия"), null);
});

test("название без посвящения не выдумывает престол", () => {
    assert.equal(slugOf("Красная церковь"), null);
    assert.equal(slugOf("Новый кафедральный собор"), null);
});

test("ключи словаря уникальны, а основы указывают на существующие записи", () => {
    const slugs = DEDICATIONS.map((d) => d.slug);
    assert.equal(new Set(slugs).size, slugs.length, "повторяющийся ключ посвящения");
    for (const [stem, slug] of DEDICATION_STEMS) {
        assert.ok(slugs.includes(slug), `основа ${stem.source} указывает в пустоту: ${slug}`);
    }
});

test("праздники записаны либо датой, либо расстоянием от Пасхи", () => {
    // Смешение одного с другим — тихая ошибка: неподвижная дата с
    // paschaOffset посчиталась бы дважды и встала не в тот день.
    for (const d of DEDICATIONS) {
        for (const f of d.feasts) {
            const fixed = f.month !== undefined && f.day !== undefined;
            const movable = f.paschaOffset !== undefined;
            assert.ok(fixed !== movable, `${d.slug}: праздник должен быть либо неподвижным, либо подвижным`);
            if (fixed) {
                assert.ok(f.month! >= 1 && f.month! <= 12, `${d.slug}: месяц вне года`);
                assert.ok(f.day! >= 1 && f.day! <= 31, `${d.slug}: число вне месяца`);
            }
        }
    }
});

test("имя, называющее два престола, разбирается на два", () => {
    // У храма престолов обычно несколько, и часть их видна прямо в имени.
    const two = matchDedications("Сретенско-Преображенская церковь (Великий Устюг)");
    assert.deepEqual(two.map((m) => m.dedication.slug), ["sretenie", "preobrazhenie"]);

    const ensemble = matchDedications("Ансамбль храмов Вознесения Господня и Иоанна Златоуста");
    assert.deepEqual(ensemble.map((m) => m.dedication.slug), ["voznesenie", "ioann-zlatoust"]);
});

test("место в скобках не становится приделом", () => {
    // «Козьмодемьянск» — город, а не престол Космы и Дамиана; «Никольск» —
    // тоже город. На выгрузке такие ложные приделы были почти всем «вторым
    // престолом», какой давал разбор.
    assert.deepEqual(
        matchDedications("Тихвинская церковь (Козьмодемьянск)").map((m) => m.dedication.slug),
        ["ikona-tihvinskaya"]);
    assert.deepEqual(
        matchDedications("Церковь Казанской иконы Божией матери (Никольск)").map((m) => m.dedication.slug),
        ["ikona-kazanskaya"]);
});

test("общая запись уступает точной того же вида", () => {
    // «Богородицы» стоит в имени всякого Богородичного храма: без этого
    // правила заглушка лезла бы вторым престолом в каждый из них.
    assert.deepEqual(
        matchDedications("Церковь Покрова Пресвятой Богородицы").map((m) => m.dedication.slug),
        ["pokrov"]);
    assert.deepEqual(
        matchDedications("Церковь Спаса Преображения").map((m) => m.dedication.slug),
        ["preobrazhenie"]);
    // А когда точного нет — заглушка и есть ответ.
    assert.deepEqual(
        matchDedications("Церковь Пресвятой Богородицы").map((m) => m.dedication.slug),
        ["bogorodica-obshee"]);
});

test("престол читается и с иным письмом", () => {
    // Каталог всемирный: у грека и румына тот же престол назван своим языком,
    // и без этих образцов их храмы остались бы вовсе без разбора.
    assert.equal(slugOf("Ιερός Ναός Αγίου Νικολάου"), "nikolay-chudotvorec");
    assert.equal(slugOf("Biserica Sfântul Nicolae"), "nikolay-chudotvorec");
    assert.equal(slugOf("Crkva Svetog Nikole"), "nikolay-chudotvorec");
    assert.equal(slugOf("Sfânta Treime"), "troica");
    assert.equal(slugOf("Ναός Μεταμορφώσεως του Σωτήρος"), "preobrazhenie");
    assert.equal(slugOf("Црква Светог Саве"), "savva-serbsky");
});

test("надстрочные снимаются, а «й» переживает это", () => {
    // Греческий тонос и румынские ă, ș, ț снимаются разбором буквы на основу и
    // знак — тем же разбором распадается и «й». Без защиты «Смоленской»
    // становилась «Смоленскои», и образец с «ой» переставал совпадать.
    assert.equal(normalizeTempleName("Αγίου Νικολάου"), "αγιου νικολαου");
    assert.equal(normalizeTempleName("Sfântul Gheorghe"), "sfantul gheorghe");
    assert.equal(slugOf("Церковь Смоленской иконы Божией Матери"), "ikona-smolenskaya");
});

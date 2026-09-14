import { test } from "node:test";
import assert from "node:assert/strict";
import { candidateRefs, findForm, learnShifts, nameForms, nameVariants } from "@/lib/places/biblematch";

test("имя в славянском стихе: другое написание, падеж, титло, короткое имя", () => {
    const bethlehem = nameForms(["Вифлеем", "Bethlehem"]);
    assert.equal(bethlehem.length, 1);
    assert.ok(findForm("и҆ ᲂу҆́мре рахи́ль, и҆ погребе́на бы́сть на пꙋтѝ є҆фра́ѳа, сѐ є҆́сть вѳлее́мъ.", bethlehem));
    assert.ok(findForm("и҆ приидо́ша до вѳлее́ма", bethlehem));

    const jerusalem = nameForms(["Иерусалим"]);
    assert.equal(findForm("и҆ приидо́ша ко і҆ерⷭ҇ли́мꙋ", jerusalem)?.form, "Иерусалим");

    const ramah = nameForms(["Рама"]);
    assert.equal(findForm("на ра́ментѣхъ свои́хъ", ramah), null);
    assert.ok(findForm("гла́съ въ ра́мѣ слы́шанъ бы́сть", ramah));

    assert.equal(findForm("до́мъ бж҃їй", nameForms(["Вефиль"])), null);
    assert.ok(findForm("и҆ и҆́де въ вефи́лѧ", nameForms(["Вефиль"])));
});

test("разные передачи одного имени: б/в, е/и, трёхбуквенное имя, прилагательное", () => {
    assert.ok(findForm("и҆ про́йдꙋтъ созадѝ веѳара́вы ѿ сѣ́вера", nameForms(["Беф-Арава"])));
    assert.ok(findForm("и҆ ви́дѣша странꙋ̀ і҆ази́ровꙋ", nameForms(["Иазер"])));
    assert.ok(findForm("И҆ ѡ҆полчи́шасѧ ѿ сѣ́вера га́їа", nameForms(["Гай"])));
    assert.ok(findForm("по все́й землѝ є҆гѵ́петстѣй", nameForms(["Древний Египет"])));
    assert.ok(findForm("ᲂу҆ ка́мене въ хѡри́вѣ", nameForms(["Хорив (гора)"])));
    assert.ok(findForm("ѳарака ца́рѧ є҆ѳїо́пска", nameForms(["Ефиопия"])));
});

test("варианты имени: скобки, «Тель-», описательное слово", () => {
    assert.deepEqual(nameVariants("Хорив (гора)"), ["Хорив"]);
    assert.deepEqual(nameVariants("Тель-Хацор"), ["Тель-Хацор", "Хацор"]);
    assert.deepEqual(nameVariants("Древний Египет"), ["Древний Египет", "Египет"]);
    assert.deepEqual(nameVariants("Святая святых"), ["Святая святых"]);
});

test("ложные находки выборок: частые слова и чужие имена не принимаются", () => {
    assert.equal(findForm("и҆ приноси́тъ да́ръ", nameForms(["Фаран"])), null);
    assert.equal(findForm("ца́рьна ѻ҆́на", nameForms(["Шарон"])), null);
    assert.equal(findForm("ѿ є҆фрѡ́ни", nameForms(["Негев"])), null);
    assert.equal(findForm("и҆ бы́сть а҆арѡ́нъ", nameForms(["Аврон"])), null);
    assert.ok(findForm("и҆ ѡ҆́гъ ца́рь васа́нскїй", nameForms(["Васан"])));
});

test("основные формы: вне своего номера стиха чужое имя места не ищется", () => {
    const egypt = nameForms(["Древний Египет", "Фараон"], "Древний Египет");
    assert.deepEqual(egypt.map((f) => f.primary), [true, true, false]);
    assert.equal(findForm("и҆ рече фараѡ́нъ", egypt)?.form, "Фараон");
    assert.equal(findForm("и҆ рече фараѡ́нъ", egypt, { primaryOnly: true }), null);
    // Сокращение под титлом наследует основную форму.
    assert.ok(nameForms(["Иерусалим"], "Иерусалим").every((f) => f.primary));
});

test("кандидаты: тот же стих, соседние, Псалтирь раньше, номер вне главы", () => {
    const counts: Record<number, number> = { 3: 20, 4: 20, 5: 32, 22: 6, 23: 10 };
    const count = (c: number) => counts[c];
    assert.deepEqual(candidateRefs("sudi", 4, 10, count).slice(0, 3), [[4, 10], [4, 11], [4, 9]]);
    assert.deepEqual(candidateRefs("3-tsarstv", 4, 21, count)[0], [5, 1]);
    assert.ok(candidateRefs("psaltir", 23, 2, count).some(([c, v]) => c === 22 && v === 3));
    assert.ok(!candidateRefs("iisus-navin", 5, 1, count).some(([c]) => c === 4));
});

test("сдвиг главы по опорам: большинство от двух опор, иначе нет", () => {
    const shifts = learnShifts([
        { chapter: 48, verse: 2, canonChapter: 47, canonVerse: 3 },
        { chapter: 48, verse: 12, canonChapter: 47, canonVerse: 13 },
        { chapter: 48, verse: 11, canonChapter: 47, canonVerse: 11 },
        { chapter: 60, verse: 7, canonChapter: 59, canonVerse: 9 },
    ]);
    assert.deepEqual(shifts.get(48), { dc: -1, dv: 1 });
    assert.equal(shifts.has(60), false);
});

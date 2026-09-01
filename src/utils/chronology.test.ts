import { test } from "node:test";
import assert from "node:assert/strict";
import * as ch from "@/utils/chronology";

// Проверяем не пересказ формул, а СВОЙСТВА, которые от них требуются: то, что
// сломается при опечатке, но не переписывается вместе с кодом. Совпадение с
// печатным Типиконом сверяется отдельно — npm run chronology:diff.

const YEARS: number[] = [];
for (let y = 1000; y <= 2500; y += 1) YEARS.push(y);

test("юлианский день ходит туда и обратно", () => {
    for (const year of YEARS) {
        for (const [month, day] of [[1, 1], [2, 28], [3, 1], [8, 31], [12, 31]]) {
            const jdn = ch.julianToJdn({ year, month, day });
            assert.deepEqual(ch.jdnToJulian(jdn), { year, month, day });
        }
    }
});

test("гражданский счёт ходит туда и обратно и обгоняет юлианский", () => {
    for (const year of YEARS) {
        const jdn = ch.julianToJdn({ year, month: 3, day: 1 });
        const civil = ch.jdnToGregorian(jdn);
        assert.equal(ch.gregorianToJdn(civil), jdn);
        // Разница стилей растёт от века к веку и в XXI веке равна тринадцати —
        // на этом и погорел зашитый в calcDay.ts «минус тринадцать».
        assert.ok(ch.gregorianToJdn({ year, month: 3, day: 1 }) <= jdn);
    }
    assert.equal(
        ch.julianToJdn({ year: 2025, month: 3, day: 1 })
        - ch.gregorianToJdn({ year: 2025, month: 3, day: 1 }), 13);
    assert.equal(
        ch.julianToJdn({ year: 1204, month: 3, day: 1 })
        - ch.gregorianToJdn({ year: 1204, month: 3, day: 1 }), 7);
});

test("Пасха всегда в воскресенье и всегда в своих границах", () => {
    for (const year of YEARS) {
        const jdn = ch.paschaJdn(year);
        assert.equal(ch.weekdayOf(jdn), "воскресенье", `Пасха ${year}`);
        const j = ch.jdnToJulian(jdn);
        const inRange = (j.month === 3 && j.day >= 22) || (j.month === 4 && j.day <= 25);
        assert.ok(inRange, `Пасха ${year} вышла за 22.03–25.04: ${j.day}.${j.month}`);
    }
});

test("Пасха 2025 — 20 апреля; 1991 — Кириопасха, 25 марта старого стиля", () => {
    assert.deepEqual(ch.jdnToGregorian(ch.paschaJdn(2025)), { year: 2025, month: 4, day: 20 });
    const k = ch.jdnToJulian(ch.paschaJdn(1991));
    assert.deepEqual({ month: k.month, day: k.day }, { month: 3, day: 25 });
});

test("круги идут по единице в год и замыкаются", () => {
    for (const leto of YEARS.map(y => y + 5508)) {
        assert.equal(ch.indikt(leto + 15), ch.indikt(leto));
        assert.equal(ch.krugSolntsu(leto + 28), ch.krugSolntsu(leto));
        assert.equal(ch.krugLune(leto + 19), ch.krugLune(leto));
        assert.equal(ch.indikt(leto + 1) % 15, (ch.indikt(leto) + 1) % 15);
    }
});

test("вруцелето шагает на единицу, а через високос — на две", () => {
    for (const leto of YEARS.map(y => y + 5508)) {
        const step = (ch.vrutseleto(leto + 1) - ch.vrutseleto(leto) + 7) % 7;
        assert.equal(step, ch.vysokosniy(leto + 1) ? 2 : 1, `лето ${leto}`);
    }
});

test("основание растёт на одиннадцать, а лунный скачок замыкает круг", () => {
    const steps: number[] = [];
    for (const leto of YEARS.slice(0, 19).map(y => y + 5508)) {
        steps.push((ch.osnovanie(leto + 1) - ch.osnovanie(leto) + 30) % 30);
    }
    // Восемнадцать шагов по одиннадцати и один по двенадцати: 210, то есть
    // ноль по тридцати. Без скачка круг за девятнадцать лет не сошёлся бы.
    assert.equal(steps.filter(s => s === 11).length, 18);
    assert.equal(steps.filter(s => s === 12).length, 1);
    assert.equal(steps.reduce((a, b) => a + b, 0) % 30, 0);
});

test("эпакта дополняет основание до двадцати одного", () => {
    for (const leto of YEARS.map(y => y + 5508)) {
        assert.equal((ch.osnovanie(leto) + ch.epakta(leto)) % 30, 21 % 30);
    }
});

test("ключ границ отвечает дню Пасхи и ходит обратно", () => {
    assert.equal(ch.KLYUCH_LETTERS.length, 35);
    const seen = new Set<string>();
    for (const year of YEARS) {
        const letter = ch.klyuchGranits(year + 5508);
        seen.add(letter);
        const p = ch.jdnToJulian(ch.paschaJdn(year));
        assert.deepEqual(ch.paschaOfKlyuch(letter), { month: p.month, day: p.day });
    }
    // За полторы тысячи лет должны встретиться все тридцать пять.
    assert.equal(seen.size, 35);
});

test("лето трёх стилей разворачивается в промежуток и складывается обратно", () => {
    for (const leto of YEARS.map(y => y + 5508)) {
        for (const style of ch.ERA_STYLES) {
            const span = ch.letoSpan(leto, style);
            assert.equal(ch.letoOf(span.first, style), leto);
            assert.equal(ch.letoOf(span.last, style), leto);
            assert.equal(ch.letoOf(span.first - 1, style), leto - 1);
            assert.ok(span.last - span.first + 1 >= 365);
        }
    }
});

test("стили расходятся ровно там, где должны", () => {
    // Мартовский и сентябрьский совпадают с марта по август и расходятся с
    // сентября; ультрамартовский обгоняет мартовский на единицу с марта.
    const may = ch.julianToJdn({ year: 1204, month: 5, day: 1 });
    const oct = ch.julianToJdn({ year: 1204, month: 10, day: 1 });
    const jan = ch.julianToJdn({ year: 1204, month: 1, day: 1 });
    assert.equal(ch.letoOf(may, "martovskiy"), ch.letoOf(may, "sentyabrskiy"));
    assert.equal(ch.letoOf(oct, "sentyabrskiy"), ch.letoOf(oct, "martovskiy") + 1);
    assert.equal(ch.letoOf(may, "ultramartovskiy"), ch.letoOf(may, "martovskiy") + 1);
    assert.equal(ch.letoOf(jan, "martovskiy"), 6711);
    assert.equal(ch.letoOf(jan, "sentyabrskiy"), 6712);
});

test("январь и февраль держат числа предыдущего года круга", () => {
    const feb = ch.julianToJdn({ year: 2025, month: 2, day: 10 });
    const apr = ch.julianToJdn({ year: 2025, month: 4, day: 10 });
    assert.equal(ch.marksOfJdn(feb).leto, 7532);
    assert.equal(ch.marksOfJdn(apr).leto, 7533);
});

test("новоюлианский ходит туда и обратно", () => {
    for (let jdn = 1900000; jdn < 2700000; jdn += 89) {
        assert.equal(ch.revisedJulianToJdn(ch.jdnToRevisedJulian(jdn)), jdn);
    }
});

test("новоюлианский совпадает с григорианским ровно с 1600 по 2800", () => {
    // Не объявляем окно, а находим его: берём день внутри и расходимся в обе
    // стороны, пока счета совпадают. Границы должны выйти теми самыми,
    // которыми их называют пособия, — иначе привязка календаря сдвинута.
    const same = (jdn: number) => {
        const g = ch.jdnToGregorian(jdn);
        const r = ch.jdnToRevisedJulian(jdn);
        return g.year === r.year && g.month === r.month && g.day === r.day;
    };
    let lo = ch.gregorianToJdn({ year: 2000, month: 1, day: 1 });
    let hi = lo;
    while (same(lo - 1)) lo -= 1;
    while (same(hi + 1)) hi += 1;
    assert.deepEqual(ch.jdnToGregorian(lo), { year: 1600, month: 3, day: 1 });
    assert.deepEqual(ch.jdnToGregorian(hi), { year: 2800, month: 2, day: 28 });
});

test("столетние високосы у новоюлианского свои", () => {
    // 2800 у григорианского високосный, у новоюлианского нет; 2900 наоборот.
    // Этим они и расходятся после 2800.
    const gregLeap = (y: number) => y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
    assert.equal(gregLeap(2000), true);
    assert.equal(ch.isRevisedJulianLeap(2000), true);
    assert.equal(gregLeap(2800), true);
    assert.equal(ch.isRevisedJulianLeap(2800), false);
    assert.equal(gregLeap(2900), false);
    assert.equal(ch.isRevisedJulianLeap(2900), true);
});

test("коптский ходит туда и обратно, и год у него 365 или 366", () => {
    for (let year = 1; year < 2000; year += 1) {
        const length = ch.copticToJdn({ year: year + 1, month: 1, day: 1 })
            - ch.copticToJdn({ year, month: 1, day: 1 });
        assert.equal(length, ch.copticYearLength(year), `коптский год ${year}`);
    }
    const epoch = ch.copticToJdn({ year: 1, month: 1, day: 1 });
    for (let jdn = epoch; jdn < 2500000; jdn += 37) {
        assert.equal(ch.copticToJdn(ch.jdnToCoptic(jdn)!), jdn);
    }
});

test("до эры мучеников коптский счёт молчит, а не выдумывает год", () => {
    const epoch = ch.copticToJdn({ year: 1, month: 1, day: 1 });
    assert.deepEqual(ch.jdnToCoptic(epoch), { year: 1, month: 1, day: 1 });
    assert.deepEqual(ch.jdnToJulian(epoch), { year: 284, month: 8, day: 29 });
    assert.equal(ch.jdnToCoptic(epoch - 1), null);
    assert.equal(ch.alexandrianLeto(epoch - 1), null);
});

test("первое тота приходится на 29 или 30 августа юлианского счёта", () => {
    // Календарь привязан к юлианскому, а не к солнцу, и это видно: начало года
    // не гуляет, а стоит на двух числах. Уедет привязка — уедут и они.
    const starts = new Set<string>();
    for (let year = 1; year < 2000; year += 1) {
        const j = ch.jdnToJulian(ch.copticToJdn({ year, month: 1, day: 1 }));
        starts.add(`${j.day}.${j.month}`);
    }
    assert.deepEqual([...starts].sort(), ["29.8", "30.8"]);
});

test("александрийская эра отстаёт от константинопольской ровно на шестнадцать", () => {
    // Проверка эпохи через независимую величину: обе эры считают лета от
    // Сотворения мира, и разница между ними — известная постоянная. Сойдись
    // она не на шестнадцати, значит эпоха коптского счёта поставлена не туда.
    for (let year = 500; year < 2500; year += 7) {
        for (const [month, day] of [[10, 5], [12, 20]]) {
            const jdn = ch.julianToJdn({ year, month, day });
            assert.equal(
                ch.letoOf(jdn, "sentyabrskiy") - ch.alexandrianLeto(jdn)!, 16,
                `${day}.${month}.${year}`);
        }
    }
});

test("короникон идёт по кругу в 532 года с общепринятых границ", () => {
    // Границы кругов — 781–1312, 1313–1844, 1845–2376 — не выведены нами, а
    // взяты из грузинской хронологии; смещение подобрано под них. Сдвинься оно,
    // единица и пятьсот тридцать вторая встали бы не на те годы.
    for (const first of [781, 1313, 1845, 2377]) {
        assert.equal(ch.koronikon(first), 1, `начало круга ${first}`);
        assert.equal(ch.koronikon(first + 531), 532, `конец круга ${first}`);
        assert.deepEqual(ch.koronikonCycle(first + 200),
            { first, last: first + 531 });
    }
    for (let year = 700; year < 2500; year += 1) {
        assert.equal(ch.koronikon(year + 532), ch.koronikon(year));
        assert.ok(ch.koronikon(year) >= 1 && ch.koronikon(year) <= 532);
    }
});

test("короникон — НЕ наш великий индиктион: длина та же, фаза разная", () => {
    // Соблазн приравнять их велик, и ошибиться легко: 532 = 28 × 19 и там и
    // там. Но византийский миротворный круг пошёл с 1941 года, где круг Солнцу
    // и круг Луне оба первые, а грузинский — с 1845. Девяносто шесть лет врозь.
    const leto = 1941 + 5508;
    assert.equal(ch.krugSolntsu(leto), 1);
    assert.equal(ch.krugLune(leto), 1);
    assert.equal(ch.koronikon(1941), 97);
    assert.deepEqual(ch.koronikonCycle(1941), { first: 1845, last: 2376 });
});

test("короникон обратным ходом даёт несколько лет, а не один", () => {
    // В этом вся его трудность для источника: «короникон 359» — это и 1139, и
    // 1671, и 2203. Отдать один год значило бы решить за историка.
    const years = ch.koronikonYears(359, 700, 2500);
    assert.deepEqual(years, [1139, 1671, 2203]);
    for (const year of years) assert.equal(ch.koronikon(year), 359);
});

test("селевкидский год начинается 1 октября юлианского счёта", () => {
    // Опора — тысячный год эры: он идёт с 1 октября 688 по 30 сентября 689.
    assert.equal(ch.seleucid({ year: 688, month: 9, day: 30 }), 999);
    assert.equal(ch.seleucid({ year: 688, month: 10, day: 1 }), 1000);
    assert.equal(ch.seleucid({ year: 689, month: 9, day: 30 }), 1000);
    assert.equal(ch.seleucid({ year: 689, month: 10, day: 1 }), 1001);
    // И дальше ровно по году, без пропусков.
    for (let year = 500; year < 2000; year += 1) {
        assert.equal(ch.seleucid({ year: year + 1, month: 5, day: 1 })
            - ch.seleucid({ year, month: 5, day: 1 }), 1);
    }
});

test("эфиопский — тот же строй, что коптский, и ровно на 276 лет впереди", () => {
    // Проверка эпохи независимой величиной: эра благодати пошла с 8 года,
    // эра мучеников с 284-го, разница 276. Сойдись она на другом числе —
    // эпоха поставлена не туда. Заодно это ловит расхождение двух счетов,
    // если египетский строй когда-нибудь разъедется сам с собой.
    for (let jdn = ch.copticToJdn({ year: 1, month: 1, day: 1 }); jdn < 2500000; jdn += 53) {
        const coptic = ch.jdnToCoptic(jdn)!;
        const ethiopian = ch.jdnToEthiopian(jdn)!;
        assert.equal(ethiopian.year - coptic.year, 276);
        assert.equal(ethiopian.month, coptic.month);
        assert.equal(ethiopian.day, coptic.day);
    }
});

test("эфиопский Новый год стоит на месте юлианским счётом и едет гражданским", () => {
    // «Эфиопский Новый год — 11 сентября» верно только для нашего века. Начало
    // года прибито к ЮЛИАНСКОМУ счёту (29 или 30 августа, как и коптское 1
    // тота), а разница стилей растёт на сутки за столетие, и гражданское число
    // вместе с ней уезжает. Проверяем поэтому неподвижное, а подвижное —
    // отдельно, чтобы подвижность была видна, а не сглажена.
    const julian = new Set<string>();
    for (let year = 1; year < 2200; year += 1) {
        const j = ch.jdnToJulian(ch.ethiopianToJdn({ year, month: 1, day: 1 }));
        julian.add(`${j.day}.${j.month}`);
    }
    assert.deepEqual([...julian].sort(), ["29.8", "30.8"]);

    const civil = (adYear: number) => {
        const year = adYear - 8 + 1;  // эфиопский год, начавшийся в этом году
        return ch.jdnToGregorian(ch.ethiopianToJdn({ year, month: 1, day: 1 }));
    };
    assert.deepEqual(
        [civil(2025).day, civil(2025).month], [11, 9], "наш век — 11 сентября");
    assert.equal(civil(1700).month, 9);
    assert.ok(civil(1700).day < 11, "три века назад начало года стояло раньше");
    assert.ok(civil(2150).day > 11, "через век с лишним встанет позже");
});

test("эфиопский ходит туда и обратно и молчит до своей эры", () => {
    const epoch = ch.ethiopianToJdn({ year: 1, month: 1, day: 1 });
    assert.deepEqual(ch.jdnToJulian(epoch), { year: 8, month: 8, day: 29 });
    assert.equal(ch.jdnToEthiopian(epoch - 1), null);
    for (let jdn = epoch; jdn < 2500000; jdn += 41) {
        assert.equal(ch.ethiopianToJdn(ch.jdnToEthiopian(jdn)!), jdn);
    }
});

test("армянский год — ровно 365 дней, без единого исключения", () => {
    // В этом всё его своеобразие: високоса нет вовсе. Одна вставленная сутка
    // здесь была бы не мелкой ошибкой, а другим календарём.
    for (let year = 1; year < 1600; year += 1) {
        assert.equal(
            ch.armenianToJdn({ year: year + 1, month: 1, day: 1 })
            - ch.armenianToJdn({ year, month: 1, day: 1 }), 365, `год ${year}`);
    }
});

test("армянский год обходит круг за 1461 год — ровно 1460 юлианских", () => {
    // Единственная проверка привязки, какая тут возможна без датированной
    // рукописи: год блуждает, и постоянного числа у его начала нет, зато
    // блуждание замкнуто. 1461 × 365 = 1460 × 365,25, день в день.
    const first = ch.armenianToJdn({ year: 1, month: 1, day: 1 });
    const after = ch.armenianToJdn({ year: 1462, month: 1, day: 1 });
    assert.equal(after - first, 533265);
    assert.equal(ch.julianToJdn({ year: 552 + 1460, month: 7, day: 11 })
        - ch.julianToJdn({ year: 552, month: 7, day: 11 }), 533265);
    assert.deepEqual(ch.jdnToJulian(first), { year: 552, month: 7, day: 11 });
    assert.deepEqual(ch.jdnToJulian(after), { year: 2012, month: 7, day: 11 });
});

test("армянское начало года гуляет по всем числам юлианского счёта", () => {
    // Прямое следствие отсутствия високоса, и лучшее доказательство, что мы
    // не подсунули втихую привязанный к солнцу календарь. За круг в 1461 год
    // начало обходит ВСЕ 366 юлианских чисел — включая 29 февраля: круг длиной
    // в 1460 юлианских лет накрывает 365 високосов, и мимо вставного дня
    // блуждание пройти не может.
    const days = new Set<string>();
    for (let year = 1; year <= 1461; year += 1) {
        const j = ch.jdnToJulian(ch.armenianToJdn({ year, month: 1, day: 1 }));
        days.add(`${j.day}.${j.month}`);
    }
    assert.equal(days.size, 366);
    assert.ok(days.has("29.2"));
    // А несуществующих чисел среди них быть не должно: это поймало бы разбор,
    // считающий месяцы не по календарю.
    for (const impossible of ["30.2", "31.4", "31.6", "31.9", "31.11"]) {
        assert.ok(!days.has(impossible), impossible);
    }
});

test("армянский ходит туда и обратно и молчит до своей эры", () => {
    const epoch = ch.armenianToJdn({ year: 1, month: 1, day: 1 });
    assert.equal(ch.jdnToArmenian(epoch - 1), null);
    assert.deepEqual(ch.jdnToArmenian(epoch), { year: 1, month: 1, day: 1 });
    for (let jdn = epoch; jdn < 2500000; jdn += 43) {
        const a = ch.jdnToArmenian(jdn)!;
        assert.equal(ch.armenianToJdn(a), jdn);
        // Тринадцатый месяц — авельяц, и в нём всегда ровно пять дней.
        if (a.month === 13) assert.ok(a.day <= 5, `авельяц ${a.day}`);
    }
});

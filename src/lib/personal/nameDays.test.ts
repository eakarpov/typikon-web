import {test} from "node:test";
import assert from "node:assert/strict";
import {nameDaysAhead} from "./nameDays";
import type {NameEntry} from "@/lib/imeniny/store";

const entry: NameEntry = {
    key: "николай",
    name: "Николай",
    saints: [
        // 6 декабря и 9 мая старого стиля — 19 декабря и 22 мая гражданского.
        { slug: "nikolaj-mirlikijskij", name: "Николай Мирликийский", dates: ["06.12", "09.05"], confidence: "sure" },
        // 3 февраля ст. ст. — 16 февраля.
        { slug: "nikolaj-japonskij", name: "Николай Японский", dates: ["03.02"], confidence: "sure" },
    ],
};

test("в окно попадает только то, что в нём лежит, и по порядку дат", () => {
    const res = nameDaysAhead(entry, "2026-05-01", 30);
    assert.deepEqual(res.map(r => [r.date, r.saint.slug]), [["2026-05-22", "nikolaj-mirlikijskij"]]);
});

test("сегодняшняя память входит: граница окна включена", () => {
    assert.equal(nameDaysAhead(entry, "2026-12-19", 0).length, 1);
});

test("окно в декабре заходит в январь и февраль следующего года", () => {
    const res = nameDaysAhead(entry, "2026-12-20", 60);
    assert.deepEqual(res.map(r => r.date), ["2027-02-16"]);
});

test("имени нет в указателе — пусто, а не ошибка", () => {
    assert.deepEqual(nameDaysAhead(null, "2026-05-01", 30), []);
});

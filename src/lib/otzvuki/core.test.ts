import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
    coveragePercent,
    densityStep,
    isReading,
    silentRuns,
    type ChapterMap,
} from "./core";

describe("чтение или отзвук", () => {
    it("зовёт чтением те роды, которые Писанием и являются", () => {
        for (const unit of ["paremiya", "apostol", "evangelie", "prokimen", "psalter-reading"]) {
            assert.equal(isReading(unit), true, unit);
        }
    });

    it("считает чтением и стих прокимна", () => {
        // 65 строк рода `verse` — это стихи прокимна и аллилуиария:
        // «Словеса́ Госпо́дня, словеса́ чи́ста» есть Пс. 11:7 сам по себе, а не
        // цитата из него. Стояло на стороне песнопений, пока не посмотрели.
        assert.equal(isReading("verse"), true);
    });

    it("зовёт отзвуком всё, что поётся", () => {
        for (const unit of [
            "stichera", "troparion", "kontakion", "ikos", "irmos", "sedalen",
            "svetilen", "velichanie", "ipakoi", "molitva",
        ]) {
            assert.equal(isReading(unit), false, unit);
        }
    });

    it("незнакомый род считает песнопением, а не чтением", () => {
        // Роды песнопений корпус добавляет по мере разбора книг, а список
        // чтений закрыт: новый род должен попасть в отзвуки сам.
        assert.equal(isReading("eksapostilariy"), false);
        assert.equal(isReading(null), false);
        assert.equal(isReading(""), false);
    });
});

describe("охват книги", () => {
    it("считает долю с одним знаком", () => {
        assert.equal(coveragePercent(1100, 2532), 43.4);
        assert.equal(coveragePercent(2532, 2532), 100);
    });

    it("молчит, когда знаменателя нет", () => {
        // Песни библейские и Даниил по LXX в справочной разбивке отсутствуют:
        // «0 %» соврало бы про них вместо того, чтобы промолчать.
        assert.equal(coveragePercent(120, null), null);
        assert.equal(coveragePercent(120, 0), null);
    });
});

describe("ступени густоты", () => {
    it("отделяет единицу от прочего", () => {
        assert.equal(densityStep(0), 0);
        assert.equal(densityStep(1), 1);
        assert.equal(densityStep(2), 2);
        assert.equal(densityStep(4), 2);
        assert.equal(densityStep(5), 3);
        assert.equal(densityStep(1349), 3);
    });
});

describe("молчащие отрезки", () => {
    const map = (voiced: Array<[number, number]>): ChapterMap[] => {
        const byChapter = new Map<number, ChapterMap>();
        for (const [chapter, verse] of voiced) {
            const entry = byChapter.get(chapter) ?? { chapter, verses: [] };
            entry.verses.push({ v: verse, sung: 1, read: 0 });
            byChapter.set(chapter, entry);
        }
        return [...byChapter.values()];
    };

    it("сшивает молчание через границу главы", () => {
        // 1:1 звучит, дальше молчит всё до конца второй главы: это ОДИН
        // отрезок 1:2–2:10, а не два по главам.
        const runs = silentRuns(map([[1, 1]]), [10, 10], 5);
        assert.deepEqual(runs, [
            { fromChapter: 1, fromVerse: 2, toChapter: 2, toVerse: 10, verses: 19 },
        ]);
    });

    it("не показывает короткие пропуски", () => {
        // Пропуск в два стиха посреди поемой главы — не молчание книги, а
        // предел сличителя.
        const runs = silentRuns(map([[1, 1], [1, 4], [1, 5]]), [5], 5);
        assert.deepEqual(runs, []);
    });

    it("ставит длинные впереди и обрезает список", () => {
        const runs = silentRuns(map([[1, 1], [2, 1], [3, 1]]), [4, 12, 4], 3, 2);
        assert.equal(runs.length, 2);
        assert.equal(runs[0].verses, 11);
        assert.equal(runs[0].fromChapter, 2);
        assert.equal(runs[1].verses, 3);
    });

    it("считает молчащей всю книгу, о которой нет ни одной цитаты", () => {
        const runs = silentRuns([], [3, 3], 3);
        assert.deepEqual(runs, [
            { fromChapter: 1, fromVerse: 1, toChapter: 2, toVerse: 3, verses: 6 },
        ]);
    });

    it("разрывает отрезок на главе, которой в разбивке нет", () => {
        // Нулевая длина в справочной разбивке значит «главы нет», а не
        // «глава молчит»: сшивать через неё отрезок было бы неправдой.
        const runs = silentRuns([], [3, 0, 3], 3);
        assert.deepEqual(runs.map(r => [r.fromChapter, r.toChapter, r.verses]), [[1, 1, 3], [3, 3, 3]]);
    });

    it("без справочной разбивки не выдумывает молчания", () => {
        assert.deepEqual(silentRuns([], null, 3), []);
    });
});

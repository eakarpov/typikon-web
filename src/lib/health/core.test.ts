import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
    changeSince,
    gapShare,
    severityOf,
    snapshotOf,
    type HealthReport,
    type Metric,
} from "./core";

const metric = (over: Partial<Metric> = {}): Metric => ({
    id: "test",
    label: "Проверка",
    gap: 5,
    total: 10,
    note: "",
    ...over,
});

describe("доля недостачи", () => {
    it("считает с одним знаком", () => {
        assert.equal(gapShare(metric({ gap: 3133, total: 3408 })), 91.9);
    });

    it("молчит, когда знаменателя нет", () => {
        assert.equal(gapShare(metric({ total: null })), null);
        assert.equal(gapShare(metric({ total: 0 })), null);
    });
});

describe("ступень тревоги", () => {
    it("растёт с долей, а не с важностью", () => {
        assert.equal(severityOf(metric({ gap: 9, total: 10 })), "high");
        assert.equal(severityOf(metric({ gap: 2, total: 10 })), "mid");
        assert.equal(severityOf(metric({ gap: 1, total: 100 })), "low");
    });

    it("на границах не соскальзывает", () => {
        assert.equal(severityOf(metric({ gap: 50, total: 100 })), "high");
        assert.equal(severityOf(metric({ gap: 10, total: 100 })), "mid");
        assert.equal(severityOf(metric({ gap: 99, total: 1000 })), "low");
    });

    it("без знаменателя не судит", () => {
        // Одна недостача из неизвестно скольких не хуже и не лучше другой.
        assert.equal(severityOf(metric({ gap: 1000, total: null })), "mid");
    });
});

describe("сравнение со снимком", () => {
    const previous = { takenAt: "2026-09-01T00:00:00.000Z", gaps: { test: 3, gone: 1 } };

    it("положительное число значит, что стало хуже", () => {
        assert.equal(changeSince(metric({ gap: 5 }), previous), 2);
        assert.equal(changeSince(metric({ gap: 1 }), previous), -2);
    });

    it("молчит про то, чего в снимке не было", () => {
        // Показатель мог появиться позже снимка — сравнивать его не с чем,
        // и «+5» тут читалось бы как рост, которого не было.
        assert.equal(changeSince(metric({ id: "fresh" }), previous), null);
        assert.equal(changeSince(metric(), null), null);
    });
});

describe("снимок отчёта", () => {
    it("оставляет одни числа, по показателю на строку", () => {
        const report: HealthReport = {
            generatedAt: "2026-09-04T10:00:00.000Z",
            groups: [
                { id: "a", title: "A", source: "", metrics: [metric({ id: "one", gap: 1 })] },
                { id: "b", title: "B", source: "", metrics: [metric({ id: "two", gap: 2 })] },
            ],
        };
        assert.deepEqual(snapshotOf(report), {
            takenAt: "2026-09-04T10:00:00.000Z",
            gaps: { one: 1, two: 2 },
        });
    });
});

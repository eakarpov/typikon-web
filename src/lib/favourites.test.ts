import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {MAX_MERGE_IDS, normaliseTextIds, TooManyFavouritesError} from "./favourites";

const oid = (n: number) => n.toString(16).padStart(24, "0");

describe("разбор списка избранного при слиянии", () => {
    it("оставляет корректные идентификаторы", () => {
        assert.deepEqual(normaliseTextIds([oid(1), oid(2)]), [oid(1), oid(2)]);
    });

    it("схлопывает повторы", () => {
        assert.deepEqual(normaliseTextIds([oid(1), oid(1)]), [oid(1)]);
    });

    it("отбрасывает мусор, но не теряет остальное", () => {
        // Список копился на устройстве и мог пережить не одну версию приложения:
        // одна битая запись не должна стоить человеку всего избранного.
        assert.deepEqual(
            normaliseTextIds([oid(1), "не-objectid", "", null, 42, {}, oid(2)]),
            [oid(1), oid(2)],
        );
    });

    it("обрезает пробелы по краям", () => {
        assert.deepEqual(normaliseTextIds([` ${oid(1)} `]), [oid(1)]);
    });

    it("не список — пустой результат, а не падение", () => {
        assert.deepEqual(normaliseTextIds(undefined), []);
        assert.deepEqual(normaliseTextIds("строка"), []);
        assert.deepEqual(normaliseTextIds({}), []);
    });

    it("слишком длинный список отвергается целиком", () => {
        // Именно ошибкой, а не молчаливым обрезанием: иначе пользователь решил бы,
        // что избранное перенеслось полностью.
        const many = Array.from({length: MAX_MERGE_IDS + 1}, (_, i) => oid(i + 1));
        assert.throws(() => normaliseTextIds(many), TooManyFavouritesError);
    });

    it("список ровно по пределу проходит", () => {
        const many = Array.from({length: MAX_MERGE_IDS}, (_, i) => oid(i + 1));
        assert.equal(normaliseTextIds(many).length, MAX_MERGE_IDS);
    });
});

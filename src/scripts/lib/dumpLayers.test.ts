import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
    EXCLUDED,
    exportedCollections,
    LAYERS,
    normalize,
    prepare,
    unclassified,
} from "./dumpLayers";

// Выгрузка отдаёт корпус наружу целиком, и цена ошибки здесь — не сломанная
// страница, а чужие данные под нашей лицензией. Поэтому проверяется не работа
// сборщика, а сам разбор по правам.

describe("разбор по правам", () => {
    it("останавливается на коллекции, о которой никто ничего не сказал", () => {
        assert.deepEqual(unclassified(["texts", "days", "новая_таблица"]), ["новая_таблица"]);
    });

    it("молчит, когда все коллекции разобраны", () => {
        const known = [...exportedCollections(), ...Object.keys(EXCLUDED)];
        assert.deepEqual(unclassified(known), []);
    });

    it("не выкладывает то, что объявлено исключённым", () => {
        const both = [...exportedCollections()].filter((name) => name in EXCLUDED);
        assert.deepEqual(both, [], `коллекция и выкладывается, и исключена: ${both}`);
    });

    it("у каждого слоя есть лицензия и указание источника", () => {
        LAYERS.forEach((layer) => {
            assert.ok(layer.license.id, `${layer.id}: нет лицензии`);
            assert.ok(layer.license.url.startsWith("https://"), `${layer.id}: нет адреса лицензии`);
            assert.ok(layer.attribution.length > 10, `${layer.id}: нечем ссылаться`);
            assert.ok(layer.rationale.length > 50, `${layer.id}: не сказано, почему условия такие`);
        });
    });

    it("храмы уходят не под нашей лицензией", () => {
        // Каталог выведен из OpenStreetMap: под CC BY 4.0 его выложить нельзя.
        const temples = LAYERS.find((layer) => layer.id === "temples");
        assert.equal(temples?.license.id, "ODbL-1.0");
    });

    it("не даёт двум файлам занять одно имя", () => {
        LAYERS.forEach((layer) => {
            const files = layer.collections.map((c) => c.file);
            assert.equal(new Set(files).size, files.length, `${layer.id}: одинаковые имена файлов`);
        });
    });

    it("отбор по изданию просит коллекцию-источник", () => {
        LAYERS.forEach((layer) => layer.collections.forEach((collection) => {
            if (collection.edition) {
                assert.ok(collection.source, `${collection.file}: издание без коллекции`);
            }
        }));
    });
});

describe("приведение документа", () => {
    it("сортирует ключи — иначе две сборки разойдутся байтами", () => {
        assert.equal(
            JSON.stringify(normalize({ b: 1, a: 2, c: { z: 1, y: 2 } })),
            '{"a":2,"b":1,"c":{"y":2,"z":1}}',
        );
    });

    it("разворачивает ObjectId в строку", () => {
        const id = { toHexString: () => "63c9638ce99d9f4d9010c598" };
        assert.equal(normalize({ _id: id })._id, "63c9638ce99d9f4d9010c598");
    });

    it("пишет дату по ISO", () => {
        assert.equal(
            normalize({ at: new Date("2026-09-02T10:00:00.000Z") }).at,
            "2026-09-02T10:00:00.000Z",
        );
    });

    it("проходит вглубь массивов", () => {
        const out = normalize({ list: [{ b: 1, a: 2 }] });
        assert.equal(JSON.stringify(out), '{"list":[{"a":2,"b":1}]}');
    });

    it("снимает поля, которые наружу не идут", () => {
        const out = prepare(
            { name: "Житие", adminInfo: "сверить по скану", content: "текст" },
            { adminInfo: "служебное" },
        );
        assert.deepEqual(Object.keys(out), ["content", "name"]);
    });

    it("оставляет нетронутым то, что снимать не просили", () => {
        const out = prepare({ name: "Житие", content: "текст" });
        assert.deepEqual(Object.keys(out), ["content", "name"]);
    });
});

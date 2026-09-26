import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { LAYERS } from "@/scripts/lib/dumpLayers";
import {
    DEPOSITS,
    depositDescription,
    duplicatedLayers,
    recordOfLayer,
    unassignedLayers,
} from "@/scripts/lib/deposits";

// Депозит — это публикация, которую нельзя отозвать. Поэтому проверяется не то,
// как собирается архив, а то, что в него попадёт: все ли слои разложены и не
// уйдёт ли слой под чужими условиями.

describe("разбор выгрузки по записям архива", () => {
    it("каждый слой отнесён к записи", () => {
        assert.deepEqual(unassignedLayers(), [],
            "слой без записи просто не попадёт в архив, и заметить это будет негде");
    });

    it("ни один слой не попал в две записи разом", () => {
        assert.deepEqual(duplicatedLayers(), [],
            "один и тот же файл в двух архивах под разными условиями — так нельзя");
    });

    it("условия записи совпадают с условиями её слоёв", () => {
        // Иначе запись объявит лицензию, под которой её содержимое не выложено:
        // ровно та ошибка, ради которой записей вообще две.
        for (const record of DEPOSITS) {
            for (const id of record.layers) {
                const layer = LAYERS.find((candidate) => candidate.id === id)!;
                assert.equal(
                    layer.license.id, record.license.id,
                    `слой ${id} под ${layer.license.id}, а запись «${record.id}» объявлена ${record.license.id}`,
                );
            }
        }
    });

    it("каталог храмов уходит отдельной записью", () => {
        // Он выведен из OpenStreetMap: под CC BY его выложить нельзя, а запись
        // в архиве держит одну лицензию на всё.
        const temples = recordOfLayer("temples");
        assert.ok(temples);
        assert.equal(temples!.license.id, "ODbL-1.0");
        assert.notEqual(temples!.id, recordOfLayer("corpus")!.id);
    });

    it("слой отцов собран только производными файлами", () => {
        // Отцы — срез корпуса: те же строки есть и в corpus/texts. Слой не должен
        // претендовать на Mongo-коллекции напрямую — иначе две записи разошлись
        // бы в составе мимо заявленного устройства «срез поверх корпуса».
        const fathers = LAYERS.find((layer) => layer.id === "fathers")!;
        assert.ok(fathers.collections.length >= 4, "срез выродился бы в пустышку");
        for (const collection of fathers.collections) {
            assert.equal(collection.source, null,
                `${collection.file}: прямая коллекция в слое-срезе`);
        }
    });

    it("у каждой записи есть чем её назвать и по чему найти", () => {
        for (const record of DEPOSITS) {
            assert.ok(record.title.length > 20, `${record.id}: заголовок слишком короток`);
            assert.ok(record.titleEn.length > 20, `${record.id}: нет заголовка латиницей`);
            assert.ok(record.keywords.length >= 4, `${record.id}: ключевых слов мало`);
            assert.ok(record.summary.length > 50, `${record.id}: нечем описать`);
        }
    });
});

describe("описание для формы", () => {
    const record = DEPOSITS[0];

    it("называет числа этой сборки, а не помнит прошлые", () => {
        const text = depositDescription(record, [
            { id: "corpus", title: "Корпус", files: 20, records: 228510, exceptions: [] },
        ]);
        // Разряды делит НЕРАЗРЫВНЫЙ пробел — так их ставит toLocaleString. Сверяем
        // тем же способом, каким они и получены, а не переписанной строкой.
        assert.ok(text.includes((228510).toLocaleString("ru-RU")), "числа сборки не попали в описание");
        assert.ok(text.includes("20 файлов"));
    });

    it("перечисляет файлы на чужих условиях поимённо", () => {
        const text = depositDescription(record, [
            {
                id: "bible",
                title: "Библия",
                files: 9,
                records: 319363,
                exceptions: [{ path: "bible/grc-ot.jsonl.gz", license: "GPL-3.0", attribution: "Свит" }],
            },
        ]);
        assert.ok(text.includes("GPL-3.0"), "чужая лицензия не названа");
        assert.ok(text.includes("bible/grc-ot.jsonl.gz"), "не сказано, какой именно файл");
        assert.ok(text.includes("Свит"), "не сказано, чья работа");
    });

    it("отсылает к соседней записи: у неё другие условия", () => {
        const text = depositDescription(record, [
            { id: "corpus", title: "Корпус", files: 1, records: 1, exceptions: [] },
        ]);
        const other = DEPOSITS.find((candidate) => candidate.id !== record.id);
        if (other) {
            assert.ok(text.includes(other.license.id), "не сказано, под какими условиями остальное");
        }
    });

    it("молчит об условиях, когда исключений нет", () => {
        const text = depositDescription(record, [
            { id: "temples", title: "Храмы", files: 1, records: 64854, exceptions: [] },
        ]);
        assert.ok(!text.includes("ОБ УСЛОВИЯХ"),
            "оговорка про чужие условия не нужна там, где чужого нет");
    });
});

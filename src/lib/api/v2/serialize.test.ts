import { test } from "node:test";
import assert from "node:assert/strict";
import {
    akathistDetail, akathistSummary, canonDetail, canonSummary,
    chantDetail, chantSummary, prayerDetail, prayerSummary,
} from "@/lib/api/v2/serialize";
import { openapi } from "@/lib/api/v2/openapi";

// Описание API и то, что ручка на самом деле отдаёт, расходятся молча: схема
// не участвует в ответе, а ответ не сверяется со схемой. Так и вышло — в схеме
// `Chant` не было ни `akathist`, ни `stanza`, ни `stanzaKind`, хотя
// сериализатор отдавал их с самого выноса поиска наружу, и клиент, писавший по
// описанию, о строфах акафиста не узнавал.
//
// Сверяем имена полей, а не значения: значения зависят от корпуса, а имена —
// это и есть договор.

/**
 * Поля схемы, включая унаследованные через allOf: карточка описана прибавкой к
 * строке перечня, и сличать надо всё вместе.
 */
const schema = (name: string): string[] => {
    const found = (openapi() as any).components.schemas[name];
    const parts = found.allOf
        ? found.allOf.map((part: any) =>
            part.$ref ? schema(part.$ref.split("/").pop()) : Object.keys(part.properties ?? {}))
        : [Object.keys(found.properties ?? {})];
    return [...new Set(parts.flat() as string[])].sort();
};

const fields = (serialized: object) => Object.keys(serialized).sort();

const pairs: Array<[string, object]> = [
    ["Chant", chantSummary({})],
    ["ChantDetail", chantDetail({})],
    ["Canon", canonSummary({})],
    ["CanonDetail", canonDetail({})],
    ["Akathist", akathistSummary({})],
    ["AkathistDetail", akathistDetail({})],
    ["Prayer", prayerSummary({})],
    ["PrayerDetail", prayerDetail({})],
];

for (const [name, serialized] of pairs) {
    test(`схема ${name} называет всё, что отдаёт сериализатор`, () => {
        assert.deepEqual(fields(serialized), schema(name));
    });
}

import { test } from "node:test";
import assert from "node:assert/strict";
import { chantDetail, chantSummary } from "@/lib/api/v2/serialize";
import { openapi } from "@/lib/api/v2/openapi";

// Описание API и то, что ручка на самом деле отдаёт, расходятся молча: схема
// не участвует в ответе, а ответ не сверяется со схемой. Так и вышло — в схеме
// `Chant` не было ни `akathist`, ни `stanza`, ни `stanzaKind`, хотя
// сериализатор отдавал их с самого выноса поиска наружу, и клиент, писавший по
// описанию, о строфах акафиста не узнавал.
//
// Сверяем имена полей, а не значения: значения зависят от корпуса, а имена —
// это и есть договор.

const schema = (name: string): Record<string, unknown> =>
    ((openapi() as any).components.schemas[name].properties) ?? {};

const fields = (serialized: object) => Object.keys(serialized).sort();

test("схема Chant называет всё, что отдаёт сериализатор", () => {
    assert.deepEqual(fields(chantSummary({})), Object.keys(schema("Chant")).sort());
});

test("схема ChantDetail называет всё, что отдаёт сериализатор", () => {
    assert.deepEqual(fields(chantDetail({})), Object.keys(schema("ChantDetail")).sort());
});

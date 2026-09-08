import { test } from "node:test";
import assert from "node:assert/strict";
import { openapi } from "@/lib/api/v2/openapi";

// Описание API читают машины и люди, и обе стороны молча: сломанная ссылка на
// схему не роняет ни сборку, ни ручку — она просто оставляет клиента без типа.
// Однажды так и вышло: `$ref: TextSummary` указывал на схему, которой в
// документе нет, и заметили это глазами.

const document = openapi() as any;

const refs = (node: unknown, out: string[] = []): string[] => {
    if (Array.isArray(node)) {
        for (const item of node) refs(item, out);
    } else if (node && typeof node === "object") {
        for (const [key, value] of Object.entries(node)) {
            if (key === "$ref" && typeof value === "string") out.push(value);
            else refs(value, out);
        }
    }
    return out;
};

test("всякая ссылка на схему ведёт в существующую схему", () => {
    const schemas = document.components.schemas;
    const broken = [...new Set(refs(document))]
        .filter(ref => !(ref.startsWith("#/components/schemas/") && ref.slice(21) in schemas));

    assert.deepEqual(broken, []);
});

test("схемы безопасности названы теми же именами, какими на них ссылаются", () => {
    const declared = new Set(Object.keys(document.components.securitySchemes));
    const used = new Set<string>();

    const collect = (list: unknown) => {
        for (const entry of (list as Array<Record<string, unknown>>) ?? []) {
            for (const name of Object.keys(entry)) used.add(name);
        }
    };

    collect(document.security);
    for (const path of Object.values<any>(document.paths)) {
        for (const operation of Object.values<any>(path)) collect(operation.security);
    }

    for (const name of used) assert.ok(declared.has(name), `нет схемы безопасности «${name}»`);
});

test("личные ручки требуют и ключа, и входа", () => {
    // Ключ отмеряет частоту, сессия говорит, чей список открывать. Объявить
    // здесь одну лишь `apiKey` значило бы пообещать, что своим ключом можно
    // открыть чужой помянник.
    for (const path of ["/api/v2/pomyannik/persons",
                        "/api/v2/pomyannik/persons/{id}",
                        "/api/v2/pomyannik/upcoming"]) {
        const security = document.paths[path].get.security;
        assert.deepEqual(security, [{ apiKey: [], cookieAuth: [] }], path);
    }
});

test("общие ручки помянника входа не требуют", () => {
    // Чины и поминальные субботы личного в себе не несут, и требовать за них
    // вход значило бы прятать общий календарь за учётной записью.
    for (const path of ["/api/v2/pomyannik/vocabulary", "/api/v2/pomyannik/calendar"]) {
        assert.equal(document.paths[path].get.security, undefined, path);
    }
});

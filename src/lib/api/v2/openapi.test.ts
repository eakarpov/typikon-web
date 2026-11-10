import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import path from "node:path";
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

// A $ref is a JSON Pointer, not just a schema name. It can name a nested
// schema, e.g. CsArticle/properties/relations. Decode fragment and ~0/~1
// escapes and check each own property so missing paths still fail the test.
const hasSchemaRef = (root: unknown, ref: string): boolean => {
    let pointer: string;
    try { pointer = decodeURIComponent(ref); } catch { return false; }
    if (!pointer.startsWith("#/components/schemas/")) return false;
    let value: unknown = root;
    for (const raw of pointer.slice(2).split("/")) {
        if (/~(?:[^01]|$)/.test(raw)) return false;
        const key = raw.replace(/~[01]/g, escape => escape === "~1" ? "/" : "~");
        if (!value || typeof value !== "object" || !Object.hasOwn(value, key)) return false;
        value = (value as Record<string, unknown>)[key];
    }
    return true;
};

test("всякая ссылка на схему ведёт в существующую схему", () => {
    const broken = [...new Set(refs(document))].filter(ref => !hasSchemaRef(document, ref));
    assert.deepEqual(broken, []);
});

test("ссылки на вложенные схемы, экранирование и отсутствующие пути проверяются по JSON Pointer", () => {
    const fixture = { components: { schemas: {
        Article: { properties: { relations: { type: "array" } } },
        "A/B~C": { type: "string" },
    } } };
    assert.equal(hasSchemaRef(fixture, "#/components/schemas/Article"), true);
    assert.equal(hasSchemaRef(fixture, "#/components/schemas/Article/properties/relations"), true);
    assert.equal(hasSchemaRef(fixture, "#/components/schemas/A~1B~0C"), true);
    assert.equal(hasSchemaRef(fixture, "#/components/schemas/A%7E1B%7E0C"), true);
    for (const ref of ["#/components/schemas/Missing", "#/components/schemas/Article/properties/missing",
        "#/components/schemas/toString", "#/components/schemas/A~2B", "#/components/schemas/%ZZ",
        "https://example.org/schema"]) assert.equal(hasSchemaRef(fixture, ref), false, ref);
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
    const personal = [
        "/api/v2/pomyannik/persons",
        "/api/v2/pomyannik/persons/{id}",
        "/api/v2/pomyannik/upcoming",
        "/api/v2/pomyannik/note/preview",
        "/api/v2/pomyannik/zapiski",
        "/api/v2/pomyannik/prinyatye",
        "/api/v2/pomyannik/prinyatye/{id}",
    ];

    for (const path of personal) {
        const operations = Object.entries<any>(document.paths[path]);
        assert.ok(operations.length, `не описан ${path}`);

        for (const [method, operation] of operations) {
            assert.deepEqual(
                operation.security, [{ apiKey: [], cookieAuth: [] }], `${method} ${path}`);
        }
    }
});

test("всякая личная ручка объясняет разницу между «нет ключа» и «нет входа»", () => {
    // Клиенту по этим двум надо поступать по-разному: по первому — признать
    // ключ негодным, по второму — предложить войти. Приложение, спутавшее их,
    // объявляет общий ключ мёртвым при всякой протухшей сессии.
    for (const path of Object.keys(document.paths).filter(p => p.startsWith("/api/v2/pomyannik/"))) {
        for (const [method, operation] of Object.entries<any>(document.paths[path])) {
            if (!operation.security) continue;
            const description = operation.responses["401"]?.description ?? "";
            assert.match(description, /session_required/, `${method} ${path}`);
        }
    }
});

test("общие ручки помянника входа не требуют", () => {
    // Чины и поминальные субботы личного в себе не несут, и требовать за них
    // вход значило бы прятать общий календарь за учётной записью.
    for (const path of ["/api/v2/pomyannik/vocabulary", "/api/v2/pomyannik/calendar"]) {
        assert.equal(document.paths[path].get.security, undefined, path);
    }
});

test("всякая ручка v2 описана в схеме", () => {
    // Забывается это именно так: ручка написана, работает, а в openapi её нет —
    // ни сборка, ни тесты не против, и узнаёт об этом тот, кто пишет клиента по
    // описанию и не находит того, что уже отдаётся.
    //
    // Имя пути собирается из каталогов: [id] → {id}, route.ts отбрасывается.
    const root = path.join(process.cwd(), "src", "app", "api", "v2");
    const routes: string[] = [];

    const walk = (dir: string) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            if (entry.isDirectory()) walk(path.join(dir, entry.name));
            else if (entry.name === "route.ts") {
                const rel = path.relative(root, dir).split(path.sep).filter(Boolean)
                    .map((segment) => segment.replace(/^\[(\.{3})?(.+)]$/, "{$2}"))
                    .join("/");
                routes.push(rel ? `/api/v2/${rel}` : "/api/v2");
            }
        }
    };
    walk(root);

    // Имя параметра в описании не обязано совпадать с именем каталога:
    // `[canonId]` описан как `{book}`, и это законно. Сверяем ФОРМУ пути.
    const shape = (route: string) => route.replace(/\{[^}]*}/g, "{}");
    const documented = new Set(Object.keys(document.paths).map(shape));
    // Корень описания сам себя не описывает, и это не пропуск.
    const undocumented = routes
        .filter((route) => !documented.has(shape(route)))
        .filter((route) => !["/api/v2", "/api/v2/openapi.json"].includes(route));

    assert.deepEqual(undocumented, []);
});

test("заметки требуют владельца при редактировании, а опубликованные ссылки открываются без входа", () => {
    for (const route of ["/api/v2/notes/sharing", "/api/v2/companion/notes"]) {
        for (const method of ["get", "post"]) {
            const operation = document.paths[route][method];
            assert.deepEqual(operation.security, [{ apiKey: [], cookieAuth: [] }]);
            assert.match(operation.responses["401"].description, /session_required/);
        }
        assert.ok(document.paths[route].post.responses["409"]);
    }
    for (const [route, schema] of [
        ["/api/v2/notes/shared/{token}", "SharedUserNote"],
        ["/api/v2/companion/notes/shared/{token}", "SharedCompanionNote"],
    ]) {
        const operation = document.paths[route].get;
        assert.deepEqual(operation.security, []);
        assert.equal(operation.responses["200"].content["application/json"].schema.$ref, `#/components/schemas/${schema}`);
        assert.ok(operation.responses["404"]);
        assert.ok(operation.responses["503"]);
        const fields = document.components.schemas[schema].properties.note.properties;
        for (const privateField of ["userId", "id", "shareToken", "sessionKey"]) assert.ok(!(privateField in fields));
    }
});

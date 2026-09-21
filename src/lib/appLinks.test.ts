import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

// Отпечаток, по которому Android решает, отдавать ли ссылки сайта приложению.
//
// Файл лежит в public/.well-known/ и правится руками — значит, портится молча:
// ошибка в нём не ломает ни сборку, ни страницу, а ссылки просто перестают
// открываться в приложении, и узнать об этом можно только с телефона в руках.
// Так уже было: в файле стояли namespace "typikon" вместо "android_app" и ни
// одного отпечатка, то есть проверка не проходила никогда.

const links = JSON.parse(
    readFileSync(path.join(process.cwd(), "public", ".well-known", "assetlinks.json"), "utf8"),
);

test("заявлено право открывать наши ссылки", () => {
    assert.ok(Array.isArray(links) && links.length > 0);
    assert.deepEqual(links[0].relation, ["delegate_permission/common.handle_all_urls"]);
});

test("цель — андроидное приложение, а не что попало", () => {
    // namespace здесь не описание, а ключ: при любом другом значении Android
    // запись просто пропускает.
    assert.equal(links[0].target.namespace, "android_app");
    assert.equal(links[0].target.package_name, "su.typikon.typikon");
});

test("отпечаток записан целиком и в том виде, в каком его печатает keytool", () => {
    // SHA-256 — тридцать два байта через двоеточие, заглавными. Обрезанный или
    // строчный отпечаток не совпадёт с подписью сборки.
    const [fingerprint, ...rest] = links[0].target.sha256_cert_fingerprints;

    assert.equal(rest.length, 0, "лишние отпечатки — это чужие сборки, допущенные к ссылкам");
    assert.match(fingerprint, /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
});

test("отпечаток тот самый, которым подписаны сборки с 1.4.0", () => {
    // Ключ подписи менять нельзя: Android ставит обновление поверх только при
    // совпадении подписи. Записан здесь целиком, чтобы подмена ключа в файле
    // была видна тестом, а не проверкой с телефона.
    assert.equal(
        links[0].target.sha256_cert_fingerprints[0],
        "06:4C:C2:B5:65:A8:57:4C:28:92:9F:EA:39:39:1B:3D:CE:FE:CD:FC:10:9D:F0:D8:DC:9F:E6:D4:DA:3D:CC:DB",
    );
});

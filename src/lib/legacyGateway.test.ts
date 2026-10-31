import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (name: string) => readFileSync(`nginx/${name}`, "utf8");
const locationsText = read("typikon-legacy-locations.conf");
// Проверяем маршрутизацию этого плоского набора location по приоритетам nginx.
// Полная проверка синтаксиса и поведения — nginx -t и check-legacy-gateway.py на машине.
const locations = [...locationsText.matchAll(/location\s+(?:(=|\^~|~)\s+)?([^\s{]+)\s*\{([^}]+)\}/g)]
    .map(([, modifier = "", path, body]) => ({ modifier, path, body }));
const route = (raw: string) => {
    const uri = raw.split("?")[0];
    const exact = locations.find(item => item.modifier === "=" && item.path === uri);
    const prefix = locations.filter(item => item.modifier !== "=" && item.modifier !== "~" && uri.startsWith(item.path))
        .sort((a, b) => b.path.length - a.path.length)[0];
    return (exact ?? (prefix?.modifier === "^~" ? prefix :
        locations.find(item => item.modifier === "~" && new RegExp(item.path).test(uri)) ?? prefix))?.body ?? "";
};

test("старые API, виджеты, все календари, файлы и Android получают proxy без смены URI", () => {
    for (const path of ["/api/v1/app/version", "/api/v2/calendar/today?lang=cu", "/api/user-notes",
        "/embed/day?date=2026-10-18", "/calendar.ics", "/parish/test/schedule.ics?lang=cu",
        "/pomyannik/feed/private-token/pomyannik.ics?names=0", "/dump/2026-09-17/a.json",
        "/app/app.apk", "/rss.xml", "/.well-known/assetlinks.json"]) {
        assert.match(route(path), /include .*typikon-legacy-proxy\.conf;/, path);
        assert.doesNotMatch(route(path), /return 30[18]/, path);
    }
});

test("страницы и похожие на исключения адреса перенаправляются с raw request_uri", () => {
    for (const path of ["/", "/reading/a?lang=cu&x=a%2Fb", "/api", "/apievil/test", "/embedder/day",
        "/dumping/a", "/application/test", "/calendar.ics/extra", "/.well-known/assetlinks.json.extra"]) {
        assert.match(route(path), /return 301 https:\/\/www\.typikon\.info\$request_uri;/, path);
    }
});

test("ACME остаётся локальным даже для имени challenge с окончанием .ics", () => {
    assert.match(route("/.well-known/acme-challenge/token.ics"), /try_files \$uri =404;/);
    assert.doesNotMatch(route("/.well-known/acme-challenge/token.ics"), /proxy|return 301/);
});

test("проксирование проверяет TLS, не переписывает тела, не кэширует и не повторяет запросы", () => {
    const proxy = read("typikon-legacy-proxy.conf");
    for (const directive of ["proxy_pass https://www.typikon.info;", "proxy_ssl_verify on;",
        "proxy_ssl_server_name on;", "proxy_ssl_name www.typikon.info;",
        "proxy_set_header Host www.typikon.info;", "proxy_set_header X-Real-IP $remote_addr;",
        "proxy_set_header X-Forwarded-For $remote_addr;", "proxy_pass_request_body on;",
        "proxy_pass_request_headers on;", "proxy_cache off;", "proxy_next_upstream off;",
        "proxy_intercept_errors off;", "proxy_redirect off;"]) assert.ok(proxy.includes(directive), directive);
    assert.doesNotMatch(proxy, /^\s*(?:proxy_method|rewrite|proxy_cookie_domain)\s/m);
});

test("оба старых имени имеют HTTP и TLS vhost с общими исключениями", () => {
    const config = read("typikon-legacy.conf");
    assert.equal(config.match(/server_name typikon\.su www\.typikon\.su;/g)?.length, 2);
    assert.equal(config.match(/include .*typikon-legacy-locations\.conf;/g)?.length, 2);
    assert.match(config, /listen 443 ssl;/);
    assert.doesNotMatch(config, /return 301/);
    const format = config.slice(config.indexOf("log_format"), config.indexOf("server {"));
    assert.doesNotMatch(format, /\$(?:request_uri|request|uri|args|http_cookie|http_authorization)\b/);
});

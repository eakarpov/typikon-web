import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const fakeCurl = `#!/usr/bin/env python3
import json, os, pathlib, sys, urllib.parse
args = sys.argv[1:]
with open(os.environ['GATEWAY_CURL_CALLS'], 'a') as f:
    f.write(json.dumps(args) + '\\n')
url = urllib.parse.urlsplit(args[-1])
method = args[args.index('--request') + 1]
status, body = 200, '{}'
headers = ['Content-Type: application/json']
if url.hostname != 'www.typikon.info':
    headers.append('X-Typikon-Gateway: legacy-nginx')
if url.path == '/api/health':
    body = json.dumps({'status': 'ready', 'buildId': 'wrong' if os.environ.get('GATEWAY_BAD') == 'build' and url.hostname != 'www.typikon.info' else 'build-42'})
elif url.path.startswith('/reading/'):
    status = 301
    headers.append('Location: https://www.typikon.info' + url.path + '?' + url.query)
elif method == 'POST': status = 405
elif method == 'OPTIONS': status = 204
elif url.path == '/api/user-notes': status = 401
elif url.path == '/.well-known/assetlinks.json':
    body = '[{"target":{"namespace":"android_app","package_name":"su.typikon.typikon"}}]'
elif url.path == '/calendar.ics': body = 'BEGIN:VCALENDAR\\nEND:VCALENDAR'
elif url.path == '/embed/day':
    body = '<html>widget</html>'
    headers = ['Content-Type: text/html', 'X-Typikon-Gateway: legacy-nginx', 'Content-Security-Policy: frame-ancestors *']
elif url.path == '/rss.xml': body = '<rss></rss>'
if os.environ.get('GATEWAY_BAD') == 'redirect' and url.hostname != 'www.typikon.info' and url.path.startswith('/api/'):
    status = 301
    headers.append('Location: https://www.typikon.info' + url.path)
pathlib.Path(args[args.index('--dump-header')+1]).write_text('HTTP/1.1 ' + str(status) + ' Test\\n' + '\\n'.join(headers) + '\\n\\n')
pathlib.Path(args[args.index('--output')+1]).write_text(body)
print(status, end='')
`;

function run(t: { after: (fn: () => void) => void }, bad = "", options: string[] = []) {
    const root = mkdtempSync(join(tmpdir(), "typikon-gateway-check-"));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    writeFileSync(join(root, "curl"), fakeCurl, { mode: 0o755 });
    const calls = join(root, "calls");
    const result = spawnSync("python3", [resolve("scripts/check-legacy-gateway.py"), "--old-ip", "192.0.2.10", "--host", "typikon.su", ...options], {
        env: { ...process.env, PATH: root + ':' + process.env.PATH, GATEWAY_CURL_CALLS: calls, GATEWAY_BAD: bad },
        encoding: "utf8", timeout: 30_000,
    });
    assert.ifError(result.error);
    return { result, calls: readFileSync(calls, "utf8").trim().split("\n").map(line => JSON.parse(line) as string[]) };
}

test("smoke проверяет HTTP/HTTPS, POST и OPTIONS без обхода TLS и следования редиректам", t => {
    const { result, calls } = run(t);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(calls.some(args => args.includes("POST")));
    assert.ok(calls.some(args => args.includes("OPTIONS")));
    assert.ok(calls.some(args => args.includes("typikon.su:80:192.0.2.10")));
    assert.ok(calls.some(args => args.includes("typikon.su:443:192.0.2.10")));
    for (const args of calls) {
        assert.equal(args[0], "--disable", "пользовательский curlrc не должен добавлять ключи или -L/-k");
        for (const flag of ["-L", "--location", "-k", "--insecure"]) assert.ok(!args.includes(flag));
    }
});

test("smoke отказывает при редиректе API, не маскируя его переходом на новый домен", t => {
    const { result } = run(t, "redirect");
    assert.equal(result.status, 1);
    assert.match(result.stderr, /ожидался 200, получен 301/);
});

test("smoke отказывает, если за шлюзом отвечает другая сборка", t => {
    const { result } = run(t, "build");
    assert.equal(result.status, 1);
    assert.match(result.stderr, /другая или неготовая сборка/);
});


test("upstream-only проверяет только новую машину до замены конфига", t => {
    const { result, calls } = run(t, "", ["--upstream-only"]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].at(-1), "https://www.typikon.info/api/health");
});

test("snapshot позволяет проверить откат и обнаруживает изменение прежних маршрутов", t => {
    const directory = mkdtempSync(join(tmpdir(), "typikon-gateway-snapshot-"));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const snapshot = join(directory, "routes.json");
    const before = run(t, "", ["--snapshot", snapshot]);
    assert.equal(before.result.status, 0, before.result.stderr);
    assert.equal(before.calls.length, 4);
    const restored = run(t, "", ["--compare-snapshot", snapshot]);
    assert.equal(restored.result.status, 0, restored.result.stderr);
    const routes = JSON.parse(readFileSync(snapshot, "utf8"));
    routes[0].status = 599;
    writeFileSync(snapshot, JSON.stringify(routes));
    const wrong = run(t, "", ["--compare-snapshot", snapshot]);
    assert.equal(wrong.result.status, 1);
    assert.match(wrong.result.stderr, /прежние маршруты после отката не восстановились/);
});

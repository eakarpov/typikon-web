import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

test("транзакция nginx: backup, конфликты портов, test/reload/smoke и возврат файлов/маршрутов", () => {
    const result = spawnSync("python3", ["-m", "unittest", "discover", "-s", "scripts/tests", "-p", "test_gateway_deploy.py", "-v"], {
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" }, encoding: "utf8", timeout: 30_000,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stdout + result.stderr);
});

test("команда шлюза требует явно выбрать старую машину до любого SSH", () => {
    const env = { ...process.env };
    delete env.TARGET;
    const result = spawnSync("bash", ["scripts/release-gateway.sh"], { env, encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /--target legacy/);
});

test("клиент шлюза передаёт цель и sudo-пароль, не отправляет ENV_FILE/базы и не выключает приложение", t => {
    const root = mkdtempSync(join(tmpdir(), "typikon-gateway-client-"));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    for (const folder of ["scripts", "nginx", "bin"]) mkdirSync(join(root, folder));
    for (const name of ["release-gateway.sh", "gateway-nginx-driver.sh", "gateway-nginx-remote.py", "check-legacy-gateway.py", "release-target.sh"]) {
        writeFileSync(join(root, "scripts", name), readFileSync(resolve("scripts", name)));
    }
    for (const name of ["typikon-legacy.conf", "typikon-legacy-locations.conf", "typikon-legacy-proxy.conf"]) {
        writeFileSync(join(root, "nginx", name), readFileSync(resolve("nginx", name)));
    }
    writeFileSync(join(root, ".env.release.legacy"), [
        "USERNAME=test", "PASSWORD=ssh-only", "HOST=old.invalid", "ENV_FILE=.env.absent",
        "GATEWAY_SITE_FILE=/etc/nginx/sites-available/old", "GATEWAY_ACME_ROOT=/var/www/acme",
    ].join("\n"));
    writeFileSync(join(root, "bin/sshpass"), `#!/bin/bash
printf '%s\\n' "$*" >> "$GATEWAY_TEST_CALLS"
last="\${@: -1}"
if [[ "$*" == *"mktemp -d /tmp/typikon-gateway."* ]]; then
    echo /tmp/typikon-gateway.fixture
elif [[ "$*" == *"bash -c"* ]]; then
    cat > "$GATEWAY_TEST_STDIN"
fi
`, { mode: 0o755 });
    const password = 'sudo $secret "with quotes"';
    const calls = join(root, "calls");
    const stdin = join(root, "stdin");
    const result = spawnSync("bash", [join(root, "scripts/release-gateway.sh"), "--target", "legacy"], {
        env: { ...process.env, LC_ALL: "C", PATH: join(root, "bin") + ':' + process.env.PATH,
            SUDO_PASSWORD: password, GATEWAY_TEST_CALLS: calls, GATEWAY_TEST_STDIN: stdin },
        encoding: "utf8", timeout: 15_000,
    });
    assert.equal(result.status, 0, result.stderr);
    const sent = readFileSync(calls, "utf8");
    assert.ok(sent.includes("GATEWAY_SITE_FILE=/etc/nginx/sites-available/old"));
    assert.ok(!sent.includes(password));
    assert.ok(!sent.includes(".env.absent"));
    assert.ok(!sent.includes("nobles.db"));
    assert.equal(readFileSync(stdin, "utf8").split("\n")[0], password);
    assert.doesNotMatch(readFileSync(stdin, "utf8"), /systemctl\s+(stop|disable|restart)/);
});

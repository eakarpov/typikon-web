import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readlinkSync, symlinkSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const script = resolve("scripts/rebuild-remote.sh");
const nextStub = `
const fs = require('node:fs');
fs.writeFileSync(process.env.TEST_PROBE, JSON.stringify({pid:process.pid, release:process.cwd()}));
setInterval(() => {}, 1000);
`;

function fixture(t: { after: (fn: () => void) => void }) {
    const root = mkdtempSync(join(tmpdir(), "typikon-deploy-"));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const source = join(root, "source"), deploy = join(root, "deploy"), bin = join(root, "bin");
    mkdirSync(source); mkdirSync(bin); mkdirSync(join(deploy, "releases"), { recursive: true });
    const write = (path: string, body: string, executable = false) => {
        mkdirSync(resolve(path, ".."), { recursive: true });
        writeFileSync(path, body, { mode: executable ? 0o755 : 0o600 });
    };
    const git = (...args: string[]) => execFileSync("git", ["-C", source, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    git("init", "-b", "master");
    write(join(source, "package.json"), '{}');
    write(join(source, "app.txt"), 'new');
    write(join(source, "fixture-next.cjs"), nextStub);
    git("add", ".");
    git("-c", "commit.gpgsign=false", "-c", "user.name=Deployment Test", "-c", "user.email=test@example.invalid", "commit", "-m", "fixture");
    git("remote", "add", "origin", source);
    const old = join(deploy, "releases/old");
    const seed = (dir: string, id: string) => {
        write(join(dir, ".next/BUILD_ID"), id);
        write(join(dir, ".env.production"), "SECRET=old\n");
        write(join(dir, "nobles.db"), "old-db");
        write(join(dir, "app.txt"), "old");
        write(join(dir, "node_modules/next/dist/bin/next"), nextStub);
    };
    seed(old, "old-build"); seed(source, "legacy-build");
    symlinkSync(old, join(deploy, "current"));
    const input = join(deploy, "incoming/upload.fixture");
    write(join(root, "corpus/data.db"), "shared-corpus");
    write(join(input, ".env.production"), "SECRET=new\nSQLITE_DB=/old/nobles.db\nRULES_DB=../corpus/data.db\n");
    write(join(input, "nobles.db"), "new-db");
    write(join(bin, "sudo"), '#!/bin/bash\n[ "$1" != -n ] || shift\nexec "$@"\n', true);
    write(join(bin, "flock"), '#!/bin/bash\n[ "${TEST_LOCKED:-0}" != 1 ]\n', true);
    write(join(bin, "sleep"), '#!/bin/bash\n/bin/sleep 0.03\n', true);
    write(join(bin, "npm"), `#!/bin/bash
set -e
if [ "$1" = ci ]; then
  mkdir -p node_modules/next/dist/bin
  cp fixture-next.cjs node_modules/next/dist/bin/next
  mkdir -p node_modules/@next
  ln -s "$TEST_ENV_MODULE" node_modules/@next/env
elif [ "$1" = run ] && [ "$2" = build ]; then
  [ "\${BUILD_FAIL:-0}" != 1 ] || exit 7
  mkdir -p .next
  basename "$PWD" > .next/BUILD_ID
else exit 9; fi
`, true);
    write(join(bin, "systemctl"), `#!${process.execPath}
const fs = require('node:fs');
fs.appendFileSync(process.env.TEST_COMMANDS, process.argv.slice(2).join(' ')+'\\n');
if(process.argv[2]==='show') console.log(process.env.WRONG_UNIT ? '/wrong' : process.env.DEPLOY_ROOT+'/current');
if(process.argv[2]==='restart' && process.env.RESTART_FAIL_NEW==='1' && fs.readFileSync(process.env.DEPLOY_ROOT+'/current/app.txt','utf8')==='new') process.exit(1);
`, true);
    write(join(bin, "curl"), `#!${process.execPath}
const fs = require('node:fs');
const url = new URL(process.argv.at(-1));
let dir;
if(url.port===process.env.PROBE_PORT) {
  if(process.env.PROBE_FAIL==='1') process.exit(1);
  try {
    const probe=JSON.parse(fs.readFileSync(process.env.TEST_PROBE,'utf8'));
    process.kill(probe.pid,0); dir=probe.release;
  } catch { process.exit(1); }
} else {
  if(process.env.SETUP_UNHEALTHY==='1') process.exit(1);
  dir=fs.readlinkSync(process.env.DEPLOY_ROOT+'/current');
  if(process.env.FAIL_PRIMARY_NEW==='1' && fs.readFileSync(dir+'/app.txt','utf8')==='new') process.exit(1);
  if(process.env.FAIL_PRIMARY_OLD==='1' && fs.readFileSync(dir+'/app.txt','utf8')==='old') process.exit(1);
}
let id=fs.readFileSync(dir+'/.next/BUILD_ID','utf8').trim();
if(process.env.WRONG_PROBE_ID==='1' && url.port===process.env.PROBE_PORT) id='stale-build';
console.log(JSON.stringify({status:'ready',buildId:id}));
`, true);
    const env = {
        ...process.env, LC_ALL: "C", LANG: "C", PATH: bin + ':' + process.env.PATH,
        REMOTE_ROOT: source, DEPLOY_ROOT: deploy, SYSTEMD_UNIT_DIR: join(root, "units"),
        APP_PORT: "3100", PROBE_PORT: "3101", HEALTH_ATTEMPTS: "3", DEPLOY_INPUT: input,
        TEST_ENV_MODULE: resolve("node_modules/@next/env"),
        TEST_PROBE: join(root, "probe.json"), TEST_COMMANDS: join(root, "commands"),
    };
    const run = (action = "deploy", extra: Record<string, string> = {}) => spawnSync("bash", [script], {
        env: { ...env, DEPLOY_ACTION: action, ...extra }, encoding: "utf8", timeout: 20_000,
    });
    const current = () => readlinkSync(join(deploy, "current"));
    const commands = () => existsSync(env.TEST_COMMANDS) ? readFileSync(env.TEST_COMMANDS, "utf8") : "";
    const stopped = () => {
        if (existsSync(env.TEST_PROBE)) {
            const { pid } = JSON.parse(readFileSync(env.TEST_PROBE, "utf8"));
            assert.throws(() => process.kill(pid, 0), "проверочный процесс должен быть остановлен");
        }
    };
    return { root, source, deploy, old, input, git, run, current, commands, stopped };
}

test("сборка изолирована, проверена и переключена; откат одной командой возвращает прежнюю", t => {
    const f = fixture(t);
    const head = f.git("rev-parse", "HEAD");
    const result = f.run();
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    const fresh = f.current();
    assert.notEqual(fresh, f.old);
    assert.equal(readlinkSync(join(f.deploy, "previous")), f.old);
    assert.equal(readFileSync(join(fresh, "nobles.db"), "utf8"), "new-db");
    assert.ok(readFileSync(join(fresh, ".env.production"), "utf8").includes(`SQLITE_DB=${fresh}/nobles.db\n`));
    assert.ok(readFileSync(join(fresh, ".env.production"), "utf8").includes(`RULES_DB=${JSON.stringify(join(f.root, "corpus/data.db"))}`));
    assert.equal(readFileSync(join(f.old, ".env.production"), "utf8"), "SECRET=old\n");
    assert.equal(readFileSync(join(f.source, "nobles.db"), "utf8"), "old-db");
    assert.equal(f.git("rev-parse", "HEAD"), head);
    assert.ok(!existsSync(f.input), "входящие секреты удаляются");
    f.stopped();
    const rollback = f.run("rollback");
    assert.equal(rollback.status, 0, rollback.stderr);
    assert.equal(f.current(), f.old);
    assert.equal(readlinkSync(join(f.deploy, "previous")), fresh);
    f.stopped();
});

for (const [name, flags] of [
    ["сбой сборки", { BUILD_FAIL: "1" }],
    ["неготовность кандидата", { PROBE_FAIL: "1" }],
    ["ответ от чужой сборки на проверочном порту", { WRONG_PROBE_ID: "1" }],
] as const) {
    test(`${name} сохраняет работающий релиз без перезапуска`, t => {
        const f = fixture(t);
        const result = f.run("deploy", flags);
        assert.notEqual(result.status, 0);
        assert.equal(f.current(), f.old);
        assert.ok(!f.commands().includes("restart"));
        assert.ok(!existsSync(f.input));
        f.stopped();
    });
}

for (const flags of [{ FAIL_PRIMARY_NEW: "1" }, { RESTART_FAIL_NEW: "1" }] as Record<string, string>[]) {
    test(`сбой после переключения автоматически возвращает прежнюю версию: ${Object.keys(flags)[0]}`, t => {
        const f = fixture(t);
        const result = f.run("deploy", flags);
        assert.notEqual(result.status, 0);
        assert.equal(f.current(), f.old);
        assert.match(result.stderr, /Прежний релиз восстановлен/);
        assert.equal(f.commands().match(/restart/g)?.length, 2);
        assert.ok(!existsSync(join(f.deploy, "previous")));
        f.stopped();
    });
}

test("нет previous — откат отказывает без изменения current", t => {
    const f = fixture(t);
    assert.notEqual(f.run("rollback").status, 0);
    assert.equal(f.current(), f.old);
    assert.ok(!f.commands().includes("restart"));
});

test("блокировка или неверная конфигурация службы не допускают переключение", t => {
    const f = fixture(t);
    assert.notEqual(f.run("deploy", { TEST_LOCKED: "1" }).status, 0);
    assert.notEqual(f.run("deploy", { WRONG_UNIT: "1" }).status, 0);
    assert.equal(f.current(), f.old);
    assert.ok(!f.commands().includes("restart"));
});

test("первичная настройка сохраняет старый checkout и не перезапускает службу", t => {
    const f = fixture(t);
    rmSync(join(f.deploy, "current"));
    const result = f.run("setup");
    assert.equal(result.status, 0, result.stderr);
    assert.equal(f.current(), f.source);
    const unit = readFileSync(join(f.root, "units/typikon-web.service.d/release.conf"), "utf8");
    assert.ok(unit.includes(`WorkingDirectory=${f.deploy}/current`));
    assert.ok(unit.includes(`${f.deploy}/current/node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3100`));
    assert.ok(!f.commands().includes("restart"));
    const deployed = f.run();
    assert.equal(deployed.status, 0, deployed.stderr);
    assert.equal(readlinkSync(join(f.deploy, "previous")), f.source);
    assert.equal(f.run("rollback").status, 0);
    assert.equal(f.current(), f.source);
    f.stopped();
});


test("неудачный откат возвращает работавшую версию и сохраняет previous", t => {
    const f = fixture(t);
    const deployed = f.run();
    assert.equal(deployed.status, 0, deployed.stderr);
    const before = f.current();
    const rollback = f.run("rollback", { FAIL_PRIMARY_OLD: "1" });
    assert.notEqual(rollback.status, 0);
    assert.equal(f.current(), before);
    assert.equal(readlinkSync(join(f.deploy, "previous")), f.old);
    assert.match(rollback.stderr, /Прежний релиз восстановлен/);
    f.stopped();
});

test("клиент отката передаёт цель и работает без локального ENV_FILE и новых загрузок", t => {
    const f = fixture(t);
    const scripts = join(f.source, "scripts");
    mkdirSync(scripts);
    for (const name of ["release.sh", "release-target.sh", "rebuild-remote.sh"]) {
        writeFileSync(join(scripts, name), readFileSync(resolve("scripts", name)));
    }
    writeFileSync(join(f.source, ".env.release.test"), [
        "USERNAME=test", "HOST=server.invalid", "PASSWORD=test-only", "ENV_FILE=.env.missing",
        `REMOTE_ROOT=${f.source}`, `DEPLOY_ROOT=${f.deploy}`,
    ].join("\n"));
    const calls = join(f.root, "client-calls");
    writeFileSync(join(f.root, "bin/sshpass"), '#!/bin/bash\nprintf "%s\\n" "$*" >> "$TEST_COMMANDS"\ncat > /dev/null\n', { mode: 0o755 });
    const result = spawnSync("bash", [join(scripts, "release.sh"), "--rollback", "--target", "test"], {
        env: { ...process.env, LC_ALL: "C", PATH: join(f.root, "bin") + ':' + process.env.PATH, TEST_COMMANDS: calls },
        encoding: "utf8", timeout: 10_000,
    });
    assert.equal(result.status, 0, result.stderr);
    const sent = readFileSync(calls, "utf8");
    assert.ok(sent.includes("DEPLOY_ACTION=rollback"));
    assert.ok(sent.includes(`REMOTE_ROOT=${f.source}`));
    assert.ok(!sent.includes("scp"));
});

test("потерянный общий корпус останавливает выкладку до переключения", t => {
    const f = fixture(t);
    rmSync(join(f.root, "corpus/data.db"));
    const result = f.run();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Настроенный RULES_DB недоступен/);
    assert.equal(f.current(), f.old);
    assert.ok(!f.commands().includes("restart"));
});


test("первичная настройка не меняет службу, если выбранный порт не обслуживает сайт", t => {
    const f = fixture(t);
    const result = f.run("setup", { SETUP_UNHEALTHY: "1" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Существующий сайт недоступен/);
    assert.ok(!existsSync(join(f.root, "units/typikon-web.service.d/release.conf")));
    assert.ok(!f.commands().includes("daemon-reload"));
});

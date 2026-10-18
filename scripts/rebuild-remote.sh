#!/usr/bin/env bash
# Получает параметры от release.sh; исполняется по ssh, не меняет исходный checkout.
set -Eeuo pipefail
umask 077
: "${REMOTE_ROOT:?REMOTE_ROOT is required}"
DEPLOY_ROOT=${DEPLOY_ROOT:-${REMOTE_ROOT}-releases}
WEB_SERVICE=${WEB_SERVICE:-typikon-web.service}
APP_PORT=${APP_PORT:-3000}
PROBE_PORT=${PROBE_PORT:-3001}
HEALTH_ATTEMPTS=${HEALTH_ATTEMPTS:-20}
RELEASE_REF=${RELEASE_REF:-master}
DEPLOY_ACTION=${DEPLOY_ACTION:-deploy}
SYSTEMD_UNIT_DIR=${SYSTEMD_UNIT_DIR:-/etc/systemd/system}
NODE_BIN=$(command -v node)

fail() { echo "$*" >&2; exit 1; }
for path in "$REMOTE_ROOT" "$DEPLOY_ROOT" "$SYSTEMD_UNIT_DIR" "$NODE_BIN"; do
    [[ "$path" =~ ^/[a-zA-Z0-9_./-]+$ ]] || fail "Нужен абсолютный путь без пробелов и спецсимволов: $path"
done
[[ "$WEB_SERVICE" =~ ^[a-zA-Z0-9_-]+\.service$ ]] || fail 'Некорректное имя службы'
for port in "$APP_PORT" "$PROBE_PORT"; do
    [[ "$port" =~ ^[0-9]+$ ]] && (( port > 0 && port < 65536 )) || fail 'Некорректный порт'
done
[[ "$APP_PORT" != "$PROBE_PORT" ]] || fail 'Порты сайта и проверки должны отличаться'
[[ "$HEALTH_ATTEMPTS" =~ ^[1-9][0-9]*$ ]] || fail 'Некорректное число проверок'
[[ "$DEPLOY_ACTION" =~ ^(setup|deploy|rollback)$ ]] || fail 'Неизвестное действие'
mkdir -p "$DEPLOY_ROOT/releases"
exec 9>"$DEPLOY_ROOT/deploy.lock"
flock -n 9 || fail 'Уже идёт другая выкладка или откат'

# rename заменяет саму ссылку, а не каталог за ней. Атомарно на одной ФС.
link_to() {
    local target=$1 name=$2 temporary="$DEPLOY_ROOT/.${2}.$$"
    ln -s "$target" "$temporary" || return 1
    if ! "$NODE_BIN" -e 'require("node:fs").renameSync(process.argv[1], process.argv[2])' "$temporary" "$DEPLOY_ROOT/$name"; then
        rm -f -- "$temporary"
        return 1
    fi
}

probe_pid=''
switching=0
old_current=''
stop_probe() {
    if [[ -n "$probe_pid" ]]; then
        kill "$probe_pid" 2>/dev/null || true
        wait "$probe_pid" 2>/dev/null || true
        probe_pid=''
    fi
}
ready_once() {
    local port=$1 release=$2 body
    if [[ "$release" == "$REMOTE_ROOT" ]]; then
        # Только первый, дорелизный checkout: у него ещё нет /api/health.
        curl --noproxy '*' -fsS --max-time 5 "http://127.0.0.1:$port/" >/dev/null
        return
    fi
    body=$(curl --noproxy '*' -fsS --max-time 5 "http://127.0.0.1:$port/api/health") || return 1
    printf '%s' "$body" | "$NODE_BIN" -e '
        const fs = require("node:fs");
        try {
            const body = JSON.parse(fs.readFileSync(0, "utf8"));
            const expected = fs.readFileSync(process.argv[1], "utf8").trim();
            process.exit(body.status === "ready" && body.buildId === expected ? 0 : 1);
        } catch { process.exit(1); }
    ' "$release/.next/BUILD_ID"
}
wait_ready() {
    local port=$1 release=$2 attempt
    for ((attempt=1; attempt<=HEALTH_ATTEMPTS; attempt++)); do
        if ready_once "$port" "$release"; then return 0; fi
        sleep 1
    done
    return 1
}
restart() { sudo -n systemctl restart "$WEB_SERVICE"; }
cleanup() {
    local status=$?
    trap - EXIT INT TERM HUP
    stop_probe
    if (( switching )); then
        echo "Проверка нового процесса не прошла; возвращаю $old_current" >&2
        if link_to "$old_current" current && restart && wait_ready "$APP_PORT" "$old_current"; then
            echo 'Прежний релиз восстановлен' >&2
        else
            echo 'ОШИБКА: автоматическое восстановление не удалось; нужна проверка службы' >&2
        fi
        status=1
    fi
    if [[ "$DEPLOY_ACTION" == deploy && -n "${DEPLOY_INPUT:-}" && "$DEPLOY_INPUT" == "$DEPLOY_ROOT"/incoming/upload.* ]]; then
        rm -rf -- "$DEPLOY_INPUT"
    fi
    exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM HUP

if [[ "$DEPLOY_ACTION" == setup ]]; then
    [[ "$(node -p 'process.versions.node.split(".")[0]')" == 22 ]] || fail 'Настройка требует Node 22'
    [[ -f "$REMOTE_ROOT/.next/BUILD_ID" ]] || fail 'Для перехода нужна существующая сборка в REMOTE_ROOT'
    if [[ ! -e "$DEPLOY_ROOT/current" && ! -L "$DEPLOY_ROOT/current" ]]; then
        link_to "$REMOTE_ROOT" current
    fi
    [[ -L "$DEPLOY_ROOT/current" ]] || fail 'current должен быть ссылкой'
    ready_once "$APP_PORT" "$(readlink "$DEPLOY_ROOT/current")" \
        || fail 'Существующий сайт недоступен на APP_PORT; проверьте порт и службу до настройки'
    # Однократно переключает путь запуска службы. Работающий процесс не трогает.
    cat > "$DEPLOY_ROOT/release.conf" <<UNIT
[Service]
WorkingDirectory=$DEPLOY_ROOT/current
ExecStart=
ExecStart=$NODE_BIN $DEPLOY_ROOT/current/node_modules/next/dist/bin/next start -H 127.0.0.1 -p $APP_PORT
UNIT
    sudo -n install -d -m 755 "$SYSTEMD_UNIT_DIR/$WEB_SERVICE.d"
    sudo -n install -m 644 "$DEPLOY_ROOT/release.conf" "$SYSTEMD_UNIT_DIR/$WEB_SERVICE.d/release.conf"
    sudo -n systemctl daemon-reload
    echo "Служба настроена на $DEPLOY_ROOT/current; работающий процесс сохранён"
    exit 0
fi

[[ -L "$DEPLOY_ROOT/current" ]] || fail 'Сначала выполните npm run release:setup для этой цели'
[[ "$(systemctl show "$WEB_SERVICE" --property=WorkingDirectory --value)" == "$DEPLOY_ROOT/current" ]] \
    || fail 'WorkingDirectory службы не указывает на current; выполните release:setup'
old_current=$(readlink "$DEPLOY_ROOT/current")
[[ -f "$old_current/.next/BUILD_ID" ]] || fail 'Текущий релиз не содержит готовой сборки'

if [[ "$DEPLOY_ACTION" == rollback ]]; then
    [[ -L "$DEPLOY_ROOT/previous" ]] || fail 'Предыдущего релиза ещё нет'
    candidate=$(readlink "$DEPLOY_ROOT/previous")
    [[ "$candidate" == "$REMOTE_ROOT" || "$candidate" == "$DEPLOY_ROOT"/releases/* ]] || fail 'Неверный путь previous'
    [[ -f "$candidate/.next/BUILD_ID" && -f "$candidate/.env.production" ]] || fail 'Предыдущий релиз неполон'
else
    : "${DEPLOY_INPUT:?Не переданы файлы релиза}"
    [[ "$DEPLOY_INPUT" == "$DEPLOY_ROOT"/incoming/upload.* ]] || fail 'Неверный каталог входящих файлов'
    [[ -f "$DEPLOY_INPUT/.env.production" && -f "$DEPLOY_INPUT/nobles.db" ]] || fail 'Не хватает окружения или nobles.db'
    [[ "$(node -p 'process.versions.node.split(".")[0]')" == 22 ]] || fail 'Сборка требует Node 22'
    [[ "$RELEASE_REF" != -* ]] || fail 'Некорректная ссылка Git'
    git -C "$REMOTE_ROOT" fetch --no-tags origin "$RELEASE_REF"
    commit=$(git -C "$REMOTE_ROOT" rev-parse --verify 'FETCH_HEAD^{commit}')
    release_id="$(date -u +%Y%m%dT%H%M%SZ)-${commit:0:12}-$$"
    candidate="$DEPLOY_ROOT/releases/$release_id"
    mkdir "$candidate"
    git -C "$REMOTE_ROOT" archive "$commit" | tar -x -C "$candidate"
    cp "$DEPLOY_INPUT/.env.production" "$candidate/.env.production"
    cp "$DEPLOY_INPUT/nobles.db" "$candidate/nobles.db"
    # Приоритет последней строки dotenv: каждый релиз использует собственный снимок.
    printf '\nSQLITE_DB=%s/nobles.db\n' "$candidate" >> "$candidate/.env.production"
    printf '%s\n' "$commit" > "$candidate/REVISION"
    (
        cd "$candidate"
        npm ci --no-audit --no-fund
        # Относительные пути прежнего checkout не должны сменить смысл из-за
        # нового рабочего каталога. Общие файлы остаются вне снимка релиза.
        NODE_ENV=production "$NODE_BIN" - "$REMOTE_ROOT" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
require("@next/env").loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
for (const key of ["RULES_DB", "DUMP_DIR", "GOOGLE_APPLICATION_CREDENTIALS"]) {
    const value = process.env[key];
    if (!value) continue;
    const absolute = path.resolve(process.argv[2], value);
    try { fs.accessSync(absolute, fs.constants.R_OK); }
    catch { console.error(`Настроенный ${key} недоступен`); process.exit(1); }
    if (!path.isAbsolute(value)) {
        fs.appendFileSync(".env.production", `\n${key}=${JSON.stringify(absolute)}\n`);
    }
}
NODE
        NODE_OPTIONS=--max-old-space-size=2048 NODE_ENV=production npm run build
    )
    [[ -s "$candidate/.next/BUILD_ID" ]] || fail 'Сборка не создала BUILD_ID'
fi

# Проверка кандидата до переключения. Лог остаётся внутри релиза для разбора.
(
    exec 9>&-
    cd "$candidate"
    exec env NODE_ENV=production "$NODE_BIN" node_modules/next/dist/bin/next start -H 127.0.0.1 -p "$PROBE_PORT"
) > "$candidate/probe.log" 2>&1 &
probe_pid=$!
wait_ready "$PROBE_PORT" "$candidate" || fail "Кандидат не готов; см. $candidate/probe.log"
kill -0 "$probe_pid" 2>/dev/null || fail 'Проверочный процесс завершился'
stop_probe

switching=1
link_to "$candidate" current
restart
wait_ready "$APP_PORT" "$candidate" || fail 'Новый процесс не подтвердил готовность'
link_to "$old_current" previous
switching=0
echo "Активен: $candidate"
echo 'Откат: npm run release:rollback (с той же --target)'

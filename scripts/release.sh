#!/usr/bin/env bash
# Локальный клиент: файлы кандидата отдельно от работающего сайта.
set -euo pipefail
REQUIRE_ENV_FILE=0
. "$(dirname "$0")/release-target.sh"
DEPLOY_ACTION=deploy
while [[ $# -gt 0 ]]; do
    case "$1" in
        --rollback) DEPLOY_ACTION=rollback ;;
        --setup) DEPLOY_ACTION=setup ;;
        *) echo "Неизвестный аргумент: $1" >&2; exit 1 ;;
    esac
    shift
done
DEPLOY_ROOT=${DEPLOY_ROOT:-${REMOTE_ROOT}-releases}
WEB_SERVICE=${WEB_SERVICE:-typikon-web.service}
APP_PORT=${APP_PORT:-3000}
PROBE_PORT=${PROBE_PORT:-3001}
RELEASE_REF=${RELEASE_REF:-master}
DEPLOY_INPUT=''
if [[ "$DEPLOY_ACTION" == deploy ]]; then
    [[ -f "$ENV_FILE" && -f nobles.db ]] || { echo 'Нужны ENV_FILE и nobles.db' >&2; exit 1; }
    printf -v prepare 'mkdir -p %q && mktemp -d %q' "$DEPLOY_ROOT/incoming" "$DEPLOY_ROOT/incoming/upload.XXXXXXXX"
    DEPLOY_INPUT=$(ssh_run "$prepare")
    # Только созданный нами каталог; ошибка scp не оставляет секреты во входящих.
    [[ "$DEPLOY_INPUT" == "$DEPLOY_ROOT"/incoming/upload.* ]] || { echo 'Некорректный путь загрузки' >&2; exit 1; }
    cleanup_upload() {
        printf -v remove 'rm -rf -- %q' "$DEPLOY_INPUT"
        ssh_run "$remove" || true
    }
    trap cleanup_upload EXIT
    scp_put "$ENV_FILE" "$DEPLOY_INPUT/.env.production"
    scp_put nobles.db "$DEPLOY_INPUT/nobles.db"
fi
printf -v remote 'REMOTE_ROOT=%q DEPLOY_ROOT=%q WEB_SERVICE=%q APP_PORT=%q PROBE_PORT=%q RELEASE_REF=%q DEPLOY_ACTION=%q DEPLOY_INPUT=%q bash -s' \
    "$REMOTE_ROOT" "$DEPLOY_ROOT" "$WEB_SERVICE" "$APP_PORT" "$PROBE_PORT" "$RELEASE_REF" "$DEPLOY_ACTION" "$DEPLOY_INPUT"
ssh_run "$remote" < "$RELEASE_DIR/rebuild-remote.sh"

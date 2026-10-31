#!/usr/bin/env bash
# Только подготовка/выкладка nginx на явно выбранной СТАРОЙ машине.
set +x
set -euo pipefail
explicit_target=${TARGET:-}
for arg in "$@"; do
    case "$arg" in --target|--target=*|-t) explicit_target=yes ;; esac
done
[[ -n "$explicit_target" ]] || { echo 'Укажи старую машину явно: npm run release:gateway -- --target legacy' >&2; exit 1; }
REQUIRE_ENV_FILE=0
. "$(dirname "$0")/release-target.sh"
[[ $# == 0 ]] || { echo "Неизвестный аргумент: $1" >&2; exit 1; }
: "${GATEWAY_SITE_FILE:?Укажи действующий файл vhost .su в GATEWAY_SITE_FILE}"
: "${GATEWAY_ACME_ROOT:?Укажи действующий ACME webroot в GATEWAY_ACME_ROOT}"
GATEWAY_NGINX_DIR=${GATEWAY_NGINX_DIR:-/etc/nginx}
GATEWAY_BACKUP_ROOT=${GATEWAY_BACKUP_ROOT:-/var/backups/typikon-legacy-gateway}
GATEWAY_CERTIFICATE=${GATEWAY_CERTIFICATE:-}
GATEWAY_CERTIFICATE_KEY=${GATEWAY_CERTIFICATE_KEY:-}
GATEWAY_CA_FILE=${GATEWAY_CA_FILE:-/etc/ssl/certs/ca-certificates.crt}
sudo_password_input=${SUDO_PASSWORD:-$PASSWORD}
unset SUDO_PASSWORD
export -n PASSWORD
case "$sudo_password_input" in
    *$'\n'*|*$'\r'*) echo 'Пароль sudo не должен содержать перевод строки' >&2; exit 1 ;;
esac
local_bundle=$(mktemp "${TMPDIR:-/tmp}/typikon-gateway.XXXXXXXX")
remote_input=''
cleanup() {
    rm -f -- "$local_bundle"
    if [[ "$remote_input" == /tmp/typikon-gateway.* ]]; then
        printf -v remove 'rm -rf -- %q' "$remote_input"
        ssh_run "$remove" || true
    fi
}
trap cleanup EXIT
# Не отправляем env, базы или код приложения.
tar -czf "$local_bundle" -C "$RELEASE_DIR/.." \
    nginx/typikon-legacy.conf nginx/typikon-legacy-locations.conf nginx/typikon-legacy-proxy.conf \
    scripts/check-legacy-gateway.py scripts/gateway-nginx-remote.py
remote_input=$(ssh_run 'umask 077; mktemp -d /tmp/typikon-gateway.XXXXXXXX')
[[ "$remote_input" == /tmp/typikon-gateway.* ]] || { echo 'Неверный временный каталог' >&2; exit 1; }
scp_put "$local_bundle" "$remote_input/bundle.tgz"
bootstrap='set +x; IFS= read -r _deploy_sudo_password; source /dev/stdin'
printf -v remote 'GATEWAY_INPUT=%q GATEWAY_SITE_FILE=%q GATEWAY_ACME_ROOT=%q GATEWAY_NGINX_DIR=%q GATEWAY_BACKUP_ROOT=%q GATEWAY_CERTIFICATE=%q GATEWAY_CERTIFICATE_KEY=%q GATEWAY_CA_FILE=%q bash -c %q' \
    "$remote_input" "$GATEWAY_SITE_FILE" "$GATEWAY_ACME_ROOT" "$GATEWAY_NGINX_DIR" "$GATEWAY_BACKUP_ROOT" \
    "$GATEWAY_CERTIFICATE" "$GATEWAY_CERTIFICATE_KEY" "$GATEWAY_CA_FILE" "$bootstrap"
echo 'Выкладка только nginx-шлюза; ENV_FILE не отправляется, старые web/ordo/cron не отключаются.'
{
    printf '%s\n' "$sudo_password_input"
    cat "$RELEASE_DIR/gateway-nginx-driver.sh"
} | ssh_run "$remote"

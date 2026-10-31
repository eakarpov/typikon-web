#!/usr/bin/env bash
# Доставка по SSH; секрет bootstrap не экспортируется и не записывается на диск.
set +x
set -euo pipefail
sudo_password=${_deploy_sudo_password:-}
unset _deploy_sudo_password SUDO_PASSWORD PASSWORD
sudo_run() {
    if [[ -n "$sudo_password" ]]; then
        printf '%s\n' "$sudo_password" | sudo -S -p '' -- "$@"
    else
        sudo -n -- "$@"
    fi
}
[[ "$GATEWAY_INPUT" == /tmp/typikon-gateway.* ]] || exit 1
umask 077
tar -xzf "$GATEWAY_INPUT/bundle.tgz" -C "$GATEWAY_INPUT"
sudo_run python3 "$GATEWAY_INPUT/scripts/gateway-nginx-remote.py" \
    --input "$GATEWAY_INPUT" --site "$GATEWAY_SITE_FILE" --acme-root "$GATEWAY_ACME_ROOT" \
    --nginx-dir "$GATEWAY_NGINX_DIR" --backup-root "$GATEWAY_BACKUP_ROOT" \
    --certificate "$GATEWAY_CERTIFICATE" --certificate-key "$GATEWAY_CERTIFICATE_KEY" --ca-file "$GATEWAY_CA_FILE"

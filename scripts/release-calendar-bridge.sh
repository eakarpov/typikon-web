#!/usr/bin/env bash
set +x
set -euo pipefail
REQUIRE_ENV_FILE=0
. "$(dirname "$0")/release-target.sh"
[[ "$TARGET" == legacy && "$HOST" == 185.26.120.198 ]] || { echo 'Выбери --target legacy'; exit 1; }
sudo_password_input=${SUDO_PASSWORD:-$PASSWORD}
case "$sudo_password_input" in *$'\n'*|*$'\r'*) echo "Некорректный пароль sudo" >&2; exit 1;; esac
unset SUDO_PASSWORD
export -n PASSWORD
remote_input=$(ssh_run 'umask 077; mktemp -d /tmp/typikon-calendar-bridge.XXXXXXXX')
[[ "$remote_input" == /tmp/typikon-calendar-bridge.* ]] || exit 1
cleanup(){ printf -v remove 'rm -rf -- %q' "$remote_input"; ssh_run "$remove" || true; }
trap cleanup EXIT
scp_put scripts/install-calendar-bridge.py "$remote_input/install.py"
scp_put nginx/typikon-legacy-locations.conf "$remote_input/locations.conf"
bootstrap='set +x; IFS= read -r calendar_sudo_password; source /dev/stdin'
printf -v remote 'CALENDAR_INPUT=%q bash -c %q' "$remote_input" "$bootstrap"
{
    printf '%s\n' "$sudo_password_input"
    cat <<'REMOTE'
set +x
set -euo pipefail
printf '%s\n' "$calendar_sudo_password" | sudo -S -p '' python3 "$CALENDAR_INPUT/install.py" "$CALENDAR_INPUT/locations.conf"
unset calendar_sudo_password
REMOTE
} | ssh_run "$remote"

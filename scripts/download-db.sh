# Скачивание базы сайта с сервера на рабочую машину.
#
# Цель задаётся ключом (release-target.sh): забрать базу можно и с испытательной
# машины, чтобы посмотреть, во что она превратилась после проверок.
#
#     npm run sync:db                     # prod
#     npm run sync:db -- --target test
. "$(dirname "$0")/release-target.sh"

put_env
scp_put "$RELEASE_DIR/download-remote-db.sh" "$REMOTE_ROOT/download-remote-db.sh"

rm -rf db-download

ssh_run "REMOTE_ROOT='$REMOTE_ROOT' bash -s" < "$RELEASE_DIR/download-remote-db.sh"

scp_get "$REMOTE_ROOT/db-download.zip" db-download.zip

unzip db-download.zip 'db-download/*'
mongorestore db-download --drop

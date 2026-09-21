# Выкладка базы typikon-meta. Цель задаётся ключом (release-target.sh):
#     bash meta-db-release.sh --target test
. "$(dirname "$0")/release-target.sh"

put_env

rm -rf meta-db
mongodump -d typikon-meta -o meta-db
zip -rX meta-db.zip meta-db
scp_put meta-db.zip "$REMOTE_ROOT/meta-db.zip"

ssh_run "REMOTE_ROOT='$REMOTE_ROOT' bash -s" < "$RELEASE_DIR/meta-db-remote.sh"

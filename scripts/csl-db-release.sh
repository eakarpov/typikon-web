# Выкладка базы typikon-csl. Цель задаётся ключом (release-target.sh):
#     bash csl-db-release.sh --target test
. "$(dirname "$0")/release-target.sh"

put_env

rm -rf csl-db
mongodump -d typikon-csl -o csl-db
zip -rX csl-db.zip csl-db
scp_put csl-db.zip "$REMOTE_ROOT/csl-db.zip"

ssh_run "REMOTE_ROOT='$REMOTE_ROOT' bash -s" < "$RELEASE_DIR/csl-db-remote.sh"

# Выкладка базы typikon-news. Цель задаётся ключом (release-target.sh):
#     bash news-db-release.sh --target test
. "$(dirname "$0")/release-target.sh"

put_env

rm -rf news-db
mongodump -d typikon-news -o news-db
zip -rX news-db.zip news-db
scp_put news-db.zip "$REMOTE_ROOT/news-db.zip"

ssh_run "REMOTE_ROOT='$REMOTE_ROOT' bash -s" < "$RELEASE_DIR/news-db-remote.sh"

# Накат базы typikon-csl на сервере. Запускается csl-db-release.sh, руками не нужен.
set -e
cd "${REMOTE_ROOT:?не сказано, где сайт — скрипт запускается из csl-db-release.sh}"

rm -rf csl-db
unzip csl-db.zip 'csl-db/*'
mongorestore csl-db --drop

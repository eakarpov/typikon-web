# Накат базы typikon-meta на сервере. Запускается meta-db-release.sh, руками не нужен.
set -e
cd "${REMOTE_ROOT:?не сказано, где сайт — скрипт запускается из meta-db-release.sh}"

rm -rf meta-db
unzip meta-db.zip 'meta-db/*'
mongorestore meta-db --drop

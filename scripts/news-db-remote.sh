# Накат базы typikon-news на сервере. Запускается news-db-release.sh, руками не нужен.
set -e
cd "${REMOTE_ROOT:?не сказано, где сайт — скрипт запускается из news-db-release.sh}"

rm -rf news-db
unzip news-db.zip 'news-db/*'
mongorestore news-db --drop

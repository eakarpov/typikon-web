# Снятие дампа на сервере. Запускается download-db.sh, руками не нужен.
set -e
cd "${REMOTE_ROOT:?не сказано, где сайт — скрипт запускается из download-db.sh}"

rm -rf db-download
mongodump -d typikon -o db-download
zip -rX db-download.zip db-download

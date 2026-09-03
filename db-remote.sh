# Накат одной части базы на сервере. Запускается release-db.sh, руками не нужен.
#
# Часть — это дамп нескольких коллекций, а не всей базы. mongorestore --drop
# сносит ровно те коллекции, что лежат в дампе, и не трогает остальные: оттого
# части можно катить по одной, в любом порядке и повторно.

set -e
cd /var/www/typikon.su/typikon-web

: "${PART:?не сказано, какая часть — скрипт запускается из release-db.sh}"

rm -rf "db-$PART"
unzip -q "db-$PART.zip"
mongorestore "db-$PART" --drop
rm -rf "db-$PART" "db-$PART.zip"

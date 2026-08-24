cd /var/www/typikon.su/typikon-web

rm -rf news-db
unzip news-db.zip news-db/*
mongorestore news-db --drop
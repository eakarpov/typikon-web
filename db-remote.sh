cd /var/www/typikon.su/typikon-web

rm -rf db
unzip db.zip db/*
mongorestore db --drop

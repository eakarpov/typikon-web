cd /var/www/typikon.su/typikon-web

rm -rf meta-db
unzip meta-db.zip meta-db/*
mongorestore meta-db --drop
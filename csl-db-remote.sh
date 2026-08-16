cd /var/www/typikon.su/typikon-web

rm -rf csl-db
unzip csl-db.zip csl-db/*
mongorestore csl-db --drop
rm -rf db
unzip db.zip db/*
mongorestore db --drop

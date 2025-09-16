rm -rf db-download
mongodump -d typikon -o db-download
zip -rX db-download.zip db-download
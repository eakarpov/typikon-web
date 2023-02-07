export $(grep -v '^#' .env.release | xargs)

scp .env.production $USERNAME:$PASSWORD@$HOST:~/typikon-web/.env.production

rm -rf db
mongodump -d typikon -o db
zip -rX db.zip db
scp db.zip $USERNAME:$PASSWORD@$HOST:~/db.zip

ssh $USERNAME:$PASSWORD@$HOST 'bash -s' < db-remote.sh

ssh $USERNAME:$PASSWORD@$HOST 'bash -s' < rebuild-remote.sh

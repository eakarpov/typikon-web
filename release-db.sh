export $(grep -v '^#' .env.release | xargs)

sshpass -f <(printf '%s\n' $PASSWORD) scp .env.production $USERNAME@$HOST:~/typikon-web/.env.production

rm -rf db
mongodump -d typikon -o db
zip -rX db.zip db
sshpass -f <(printf '%s\n' $PASSWORD) scp db.zip $USERNAME@$HOST:~/db.zip

sshpass -f <(printf '%s\n' $PASSWORD) ssh $USERNAME@$HOST 'bash -s' < db-remote.sh

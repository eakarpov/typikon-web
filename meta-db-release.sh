export $(grep -v '^#' .env.release | xargs)

sshpass -f <(printf '%s\n' $PASSWORD) scp .env.production $USERNAME@$HOST:~/typikon-web/.env.production

rm -rf meta-db
mongodump -d typikon-meta -o meta-db
zip -rX meta-db.zip meta-db
sshpass -f <(printf '%s\n' $PASSWORD) scp meta-db.zip $USERNAME@$HOST:~/meta-db.zip

sshpass -f <(printf '%s\n' $PASSWORD) ssh $USERNAME@$HOST 'bash -s' < meta-db-remote.sh

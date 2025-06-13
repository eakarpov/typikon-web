export $(grep -v '^#' .env.release | xargs)

sshpass -f <(printf '%s\n' $PASSWORD) scp .env.production $USERNAME@$HOST:~/typikon-web/.env.production

rm -rf csl-db
mongodump -d typikon-csl -o csl-db
zip -rX csl-db.zip csl-db
sshpass -f <(printf '%s\n' $PASSWORD) scp csl-db.zip $USERNAME@$HOST:~/csl-db.zip

sshpass -f <(printf '%s\n' $PASSWORD) ssh $USERNAME@$HOST 'bash -s' < csl-db-remote.sh

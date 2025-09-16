export $(grep -v '^#' .env.release | xargs)

sshpass -f <(printf '%s\n' $PASSWORD) scp .env.production $USERNAME@$HOST:~/typikon-web/.env.production
sshpass -f <(printf '%s\n' $PASSWORD) scp download-remote-db.sh $USERNAME@$HOST:~/download-remote-db.sh

rm -rf db-download

sshpass -f <(printf '%s\n' $PASSWORD) ssh $USERNAME@$HOST 'bash -s' < download-remote-db.sh

sshpass -f <(printf '%s\n' $PASSWORD) scp $USERNAME@$HOST:~/db-download.zip db-download.zip

unzip db-download.zip db-download/*
mongorestore db-download --drop

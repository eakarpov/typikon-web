export $(grep -v '^#' .env.release | xargs)

sshpass -f <(printf '%s\n' $PASSWORD) scp .env.production $USERNAME@$HOST:/var/www/typikon.su/typikon-web/.env.production
sshpass -f <(printf '%s\n' $PASSWORD) scp nobles.db $USERNAME@$HOST:/var/www/typikon.su/typikon-web/nobles.db

#sshpass -f <(printf '%s\n' $PASSWORD) scp mongod_dump.sh $USERNAME@$HOST:/var/www/typikon.su/typikon-web/mongod_dump.sh

sshpass -f <(printf '%s\n' $PASSWORD) ssh $USERNAME@$HOST 'bash -s' < rebuild-remote.sh

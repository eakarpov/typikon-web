export $(grep -v '^#' .env.release | xargs)

sshpass -f <(printf '%s\n' $PASSWORD) scp .env.production $USERNAME@$HOST:~/typikon-web/.env.production

sshpass -f <(printf '%s\n' $PASSWORD) ssh $USERNAME@$HOST 'bash -s' < rebuild-remote.sh

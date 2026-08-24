export $(grep -v '^#' .env.release | xargs)

sshpass -f <(printf '%s\n' $PASSWORD) scp .env.production $USERNAME@$HOST:/var/www/typikon.su/typikon-web/.env.production

rm -rf news-db
mongodump -d typikon-news -o news-db
zip -rX news-db.zip news-db
sshpass -f <(printf '%s\n' $PASSWORD) scp news-db.zip $USERNAME@$HOST:/var/www/typikon.su/typikon-web/news-db.zip

sshpass -f <(printf '%s\n' $PASSWORD) ssh $USERNAME@$HOST 'bash -s' < news-db-remote.sh

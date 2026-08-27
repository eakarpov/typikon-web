# Доставка корпуса typikon-rules на сервер.
#
# Здесь, в отличие от прочих release-скриптов, не mongodump: это не база сайта,
# а ГОТОВЫЙ ФАЙЛ SQLite, который целиком пересобирается соседним проектом
# (python3 src/build_db.py) из разобранных книг и правил устава. Собирать его
# на сервере незачем — там нет ни книг, ни правил, ни Python.
#
# Путь к файлу берётся из RULES_DB в .env.production: если он переедет, менять
# придётся в одном месте, а не в двух.

export $(grep -v '^#' .env.release | xargs)

RULES_DB_LOCAL=${RULES_DB_LOCAL:-../typikon-rules/src/data.db}
RULES_DB_REMOTE=$(grep -v '^#' .env.production | grep '^RULES_DB=' | cut -d= -f2-)

if [ ! -f "$RULES_DB_LOCAL" ]; then
    echo "нет $RULES_DB_LOCAL — собери корпус: cd ../typikon-rules && python3 src/build_db.py"
    exit 1
fi

# Проверяем, что в файле есть поисковый индекс. Без него страница песнопений
# будет молча ничего не находить, и понять это на сервере окажется нечем.
if ! sqlite3 "$RULES_DB_LOCAL" "SELECT count(*) FROM content_items_fts LIMIT 1" >/dev/null 2>&1; then
    echo "в $RULES_DB_LOCAL нет content_items_fts — пересобери корпус"
    exit 1
fi

# Окружение везём вместе с корпусом, как и все прочие release-скрипты.
# Без этого получается тихая ловушка: файл лежит там, где надо, а сайт про
# RULES_DB не знает и честно сообщает, что корпус не выложен.
sshpass -f <(printf '%s\n' $PASSWORD) scp .env.production \
    $USERNAME@$HOST:/var/www/typikon.su/typikon-web/.env.production

echo "корпус: $RULES_DB_LOCAL -> $USERNAME@$HOST:$RULES_DB_REMOTE"
sqlite3 "$RULES_DB_LOCAL" "SELECT '  песнопений: ' || count(*) FROM content_items_fts"

rm -f rules-db.zip
zip -jX rules-db.zip "$RULES_DB_LOCAL"
sshpass -f <(printf '%s\n' $PASSWORD) scp rules-db.zip $USERNAME@$HOST:~/rules-db.zip

sshpass -f <(printf '%s\n' $PASSWORD) ssh $USERNAME@$HOST \
    "RULES_DB_REMOTE='$RULES_DB_REMOTE' bash -s" < rules-db-remote.sh

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
#
# Вывод sqlite3 ловим, а не глушим: «нет таблицы» и «файл занят» — разные беды с
# разным лечением, и первая просит пересборки, а вторая просит подождать. Пока
# ошибка уходила в /dev/null, идущая рядом пересборка корпуса (она удаляет и
# создаёт файл заново, держа его открытым) выглядела как отсутствие индекса.
FTS_CHECK=$(sqlite3 "$RULES_DB_LOCAL" "SELECT count(*) FROM content_items_fts" 2>&1)
if ! [ "$FTS_CHECK" -eq "$FTS_CHECK" ] 2>/dev/null; then
    case "$FTS_CHECK" in
        *"database is locked"*|*"database is busy"*)
            echo "$RULES_DB_LOCAL занята — похоже, идёт пересборка корпуса"
            echo "  проверь:  ps aux | grep build_db.py   — и дождись её конца"
            ;;
        *)
            echo "в $RULES_DB_LOCAL нет content_items_fts — пересобери корпус:"
            echo "  cd ../typikon-rules && python3 src/build_db.py"
            echo "  sqlite3 сказал: $FTS_CHECK"
            ;;
    esac
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

# Свод цитируемости (/otzvuki) считается НЕ на лету: полный проход по цитатам —
# несколько секунд, и результат лежит в Монге. Значит после нового корпуса его
# надо пересчитать, иначе страница описывает прежнюю сборку. Она об этом
# скажет сама — числа носят отпечаток корпуса и сверяются с лежащим файлом, —
# но лучше пересчитать сразу.
#
# Сюда сам прогон не вставлен нарочно: этот сеанс идёт по ssh без tty, npm в
# нём нет, и добавить сюда сборку значило бы дать скрипту второй способ упасть.
echo ""
echo "корпус доехал. Дальше — свод цитируемости, он считается отдельно:"
echo "  npm run citations:stats -- --write"


# Выкладка службы сборки последования (проект typikon-rules).
#
# Скрипт живёт здесь, а не в typikon-rules, по той же причине, что и остальные
# release-*: тут лежат доступы к серверу (.env.release) и весь порядок выкладки.
#
# Едут только src/ и rules/ — код сборки и сами правила устава. Разобранные
# книги (parsed/) и сырые выгрузки (raw/) на сервере не нужны: всё, что из них
# получилось, уже лежит в корпусе, а его везёт release:rules-db.
#
# Порядок: сперва корпус (npm run release:rules-db), потом эта служба.

export $(grep -v '^#' .env.release | xargs)

RULES_SRC=${RULES_SRC:-../typikon-rules}
# Рядом с сайтом и корпусом, а не в домашнем каталоге: служба системная, и
# принадлежать одному человеку ей незачем. Рядом, а не внутри typikon-web —
# там своё рабочее дерево git со своей сборкой.
REMOTE_DIR=/var/www/typikon.su/typikon-ordo

if [ ! -f "$RULES_SRC/src/ordo_service.py" ]; then
    echo "нет $RULES_SRC/src/ordo_service.py — не найден проект typikon-rules"
    exit 1
fi

# Окружение — вместе со службой: сайт узнаёт адрес службы из ORDO_SERVICE_URL,
# и без него раздел последования скажет, что сборка недоступна, хотя она уже
# поднята.
sshpass -f <(printf '%s\n' $PASSWORD) scp .env.production \
    $USERNAME@$HOST:/var/www/typikon.su/typikon-web/.env.production

# Снимок Псалтири едет вместе со службой, хотя raw/ вообще-то не ездит.
#
# Причина: Псалтирь мы не разбирали своим парсером и берём готовой — из Монги
# либо из этого снимка. На сервере Монга есть, но драйвера к ней нет (pymongo
# не установлен, и ставить его ради одного файла незачем), поэтому остаётся
# снимок. Без него галочка «тексты псалмов» молча даёт пустые места.
#
# Снимка может не быть и локально — тогда просто не поедет: службу это не
# ломает, псалмы останутся пустыми ровно как сейчас.
# Список — МАССИВОМ, а не строкой. Строку из нескольких путей bash разбил бы
# по пробелам, zsh не разбил бы вовсе, и в одном из шеллов всё уехало бы одним
# аргументом с переводом строки внутри: zip такого файла не найдёт и промолчит,
# а на сервере это выглядело бы как «псалмы почему-то пустые».
PSALTER=()
for f in "$RULES_SRC"/raw/psaltir-*.json; do
    [ -e "$f" ] && PSALTER+=("raw/$(basename "$f")")
done

if [ ${#PSALTER[@]} -gt 0 ]; then
    echo "  Псалтирь: ${PSALTER[*]}"
else
    echo "  Псалтири нет в raw/ — «тексты псалмов» на сервере останутся пустыми"
fi

rm -f ordo.zip
(cd "$RULES_SRC" && zip -rX - src rules "${PSALTER[@]}" \
    --exclude 'src/__pycache__/*' 'src/data.db' 'src/viewer/*') > ordo.zip
echo "поехало: $(du -h ordo.zip | cut -f1)"

sshpass -f <(printf '%s\n' $PASSWORD) scp ordo.zip $USERNAME@$HOST:~/ordo.zip
sshpass -f <(printf '%s\n' $PASSWORD) scp "$RULES_SRC/typikon-ordo.service" $USERNAME@$HOST:~/typikon-ordo.service

sshpass -f <(printf '%s\n' $PASSWORD) ssh $USERNAME@$HOST "REMOTE_DIR='$REMOTE_DIR' bash -s" < ordo-remote.sh

# КЭШ ОТВЕТОВ УСТАВА СБРАСЫВАЕТСЯ ЗДЕСЬ. Сайт держит ответ движка на дату час
# (тег `ordo`: трапеза, а дальше и всё, что встанет на движок). Правила устава
# только что переехали — и без этого сброса сайт до часа отвечал бы прежними,
# причём именно в тот час, когда правку и пришли посмотреть.
echo "сбрасываю кэш ответов устава…"
curl -sS -X POST "${REVALIDATE_URL:-https://www.typikon.su}/api/revalidate" \
     -H 'Content-Type: application/json' \
     -H "x-revalidate-token: $REVALIDATE_TOKEN" \
     -d '{"tags":["ordo"]}' \
  || echo "  кэш сбросить не удалось — сайт отдаст прежнее не дольше часа"

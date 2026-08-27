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
REMOTE_DIR=/home/admin/typikon-ordo

if [ ! -f "$RULES_SRC/src/ordo_service.py" ]; then
    echo "нет $RULES_SRC/src/ordo_service.py — не найден проект typikon-rules"
    exit 1
fi

rm -f ordo.zip
(cd "$RULES_SRC" && zip -rX - src rules --exclude 'src/__pycache__/*' 'src/data.db' 'src/viewer/*') > ordo.zip
echo "поехало: $(du -h ordo.zip | cut -f1)"

sshpass -f <(printf '%s\n' $PASSWORD) scp ordo.zip $USERNAME@$HOST:~/ordo.zip
sshpass -f <(printf '%s\n' $PASSWORD) scp "$RULES_SRC/typikon-ordo.service" $USERNAME@$HOST:~/typikon-ordo.service

sshpass -f <(printf '%s\n' $PASSWORD) ssh $USERNAME@$HOST "REMOTE_DIR='$REMOTE_DIR' bash -s" < ordo-remote.sh

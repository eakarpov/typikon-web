# Выкладка выгрузки корпуса на сервер.
#
# Выгрузка — не база сайта, а АРТЕФАКТ: она пересобирается из базы командой
# npm run corpus:dump и никем не правится. Поэтому едет готовыми файлами, как
# корпус песнопений, а не mongodump'ом.
#
# Кладётся ВНЕ каталога сайта, в /var/www/typikon-data — по той же причине, по
# какой там же лежат корпус песнопений и сборки приложения: в каталоге выкладки
# идут git pull, npm i и сборка, и сделанный там `git clean -fdx` (обычный приём,
# когда сборка сломалась) снёс бы выгрузку вместе с остальным неотслеживаемым.
#
# Раздаёт файлы nginx, сайт их не проксирует. Что нужно на сервере один раз —
# см. раздел «Выгрузка корпуса» в ROADMAP.md.
#
# Порядок:
#   npm run corpus:dump        # собрать (нужен доступ к базе)
#   bash release-data.sh       # выложить

export $(grep -v '^#' .env.release | xargs)

DUMP_LOCAL=${DUMP_LOCAL:-data-dump}
DUMP_REMOTE=${DUMP_REMOTE:-/var/www/typikon-data}

if [ ! -f "$DUMP_LOCAL/manifest.json" ]; then
    echo "нет $DUMP_LOCAL/manifest.json — собери выгрузку: npm run corpus:dump"
    exit 1
fi

# Манифест — то, по чему выгрузку читают снаружи: без него страница /data не
# покажет ни файлов, ни сумм, а сама выгрузка станет кучей архивов без описи.
# Проверяем, что он разбирается, ЗДЕСЬ: на сервере это выяснять поздно.
if ! node -e "JSON.parse(require('fs').readFileSync('$DUMP_LOCAL/manifest.json','utf8'))"; then
    echo "$DUMP_LOCAL/manifest.json не разбирается — пересобери выгрузку"
    exit 1
fi

echo "выгрузка: $DUMP_LOCAL -> $USERNAME@$HOST:$DUMP_REMOTE"
node -e "
const m = JSON.parse(require('fs').readFileSync('$DUMP_LOCAL/manifest.json','utf8'));
const files = m.layers.flatMap(l => l.files);
const records = files.reduce((s, f) => s + f.records, 0);
const bytes = files.reduce((s, f) => s + f.bytes, 0);
console.log('  собрана ' + m.builtAt + ': ' + files.length + ' файлов, ' +
    records.toLocaleString('ru-RU') + ' записей, ' + (bytes / 1048576).toFixed(1) + ' МБ');
"

rm -f data-dump.zip
zip -rX data-dump.zip "$DUMP_LOCAL"
sshpass -f <(printf '%s\n' $PASSWORD) scp data-dump.zip $USERNAME@$HOST:~/data-dump.zip

sshpass -f <(printf '%s\n' $PASSWORD) ssh $USERNAME@$HOST \
    "DUMP_REMOTE='$DUMP_REMOTE' DUMP_LOCAL='$DUMP_LOCAL' bash -s" < data-remote.sh

# Приём выгрузки на сервере. Запускается release-data.sh, руками не нужен.
#
# Каждая сборка кладётся в СВОЙ каталог по версии (дате сборки), а latest —
# символическая ссылка на последнюю. Так у версии есть постоянный адрес, на
# который можно сослаться в работе: /dump/2026-09-07/ завтра означает ровно то
# же, что сегодня. Прежние сборки не удаляются — в этом весь смысл; каждая весит
# около тридцати мегабайт.
#
# Ссылка переставляется переименованием (mv -T), а не парой «удалить-создать»:
# иначе есть мгновение, когда latest не существует вовсе, и запрос в это
# мгновение получил бы 404.

set -e

DUMP_REMOTE=${DUMP_REMOTE:-/var/www/typikon-data}
DUMP_LOCAL=${DUMP_LOCAL:-data-dump}

rm -rf ~/data-dump-incoming
mkdir -p ~/data-dump-incoming
unzip -q ~/data-dump.zip -d ~/data-dump-incoming

INCOMING=~/data-dump-incoming/"$DUMP_LOCAL"
if [ ! -f "$INCOMING/manifest.json" ]; then
    echo "в архиве нет $DUMP_LOCAL/manifest.json"
    exit 1
fi

# Версия берётся из самого манифеста, а не из даты на сервере: выгрузка собрана
# на другой машине и, может быть, вчера.
VERSION=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$INCOMING/manifest.json','utf8')).version || '')")
if [ -z "$VERSION" ]; then
    echo "в манифесте нет поля version — пересобери выгрузку (npm run corpus:dump)"
    exit 1
fi

mkdir -p "$DUMP_REMOTE"

TARGET="$DUMP_REMOTE/$VERSION"
if [ -d "$TARGET" ]; then
    # Выложенная версия неизменна — на этом держится вся затея с постоянным
    # адресом: сославшийся на /dump/2026-09-07/ должен завтра получить ровно то,
    # что скачал, иначе контрольные суммы у него на руках перестанут сходиться.
    # Поэтому по умолчанию замена запрещена: собери выгрузку заново, и версия
    # получит сегодняшнюю дату.
    #
    # Заменить можно нарочно — DUMP_REPLACE=1 bash release-data.sh, — и это
    # оправдано ровно в один день: пока версия выложена только что и на неё ещё
    # никто не сослался.
    if [ "${DUMP_REPLACE:-}" != "1" ]; then
        echo "версия $VERSION уже выложена, и менять её нельзя: на неё могли сослаться."
        echo "пересобери выгрузку (получится новая версия) либо, если она выложена"
        echo "только что и ссылок на неё ещё нет: DUMP_REPLACE=1 bash release-data.sh"
        rm -rf ~/data-dump-incoming ~/data-dump.zip
        exit 1
    fi
    echo "версия $VERSION уже выложена — заменяю по DUMP_REPLACE=1"
    rm -rf "$TARGET".old
    mv "$TARGET" "$TARGET".old
fi

mv "$INCOMING" "$TARGET"
rm -rf "$TARGET".old ~/data-dump-incoming ~/data-dump.zip

# Права на чтение всем: файлы раздаёт nginx от своего пользователя.
chmod -R a+rX "$TARGET"

# latest переставляется одним движением.
ln -sfn "$VERSION" "$DUMP_REMOTE/.latest.new"
mv -T "$DUMP_REMOTE/.latest.new" "$DUMP_REMOTE/latest"

echo "выложено в $TARGET, latest -> $VERSION"
du -sh "$TARGET"
echo "версии на сервере:"
ls -1 "$DUMP_REMOTE" | grep -v '^latest$'

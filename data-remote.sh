# Приём выгрузки на сервере. Запускается release-data.sh, руками не нужен.
#
# Раскладывается во ВРЕМЕННЫЙ каталог и переносится на место одним движением:
# файлы раздаёт nginx, и распаковка поверх живого каталога означала бы несколько
# секунд, когда манифест уже новый, а половина файлов ещё старая. Скачавший в эту
# секунду получил бы выгрузку, не сходящуюся с собственными контрольными суммами.

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

mkdir -p "$(dirname "$DUMP_REMOTE")"
rm -rf "$DUMP_REMOTE".old
[ -d "$DUMP_REMOTE" ] && mv "$DUMP_REMOTE" "$DUMP_REMOTE".old
mv "$INCOMING" "$DUMP_REMOTE"
rm -rf "$DUMP_REMOTE".old ~/data-dump-incoming ~/data-dump.zip

# Права на чтение всем: файлы раздаёт nginx от своего пользователя.
chmod -R a+rX "$DUMP_REMOTE"

echo "выложено в $DUMP_REMOTE:"
du -sh "$DUMP_REMOTE"

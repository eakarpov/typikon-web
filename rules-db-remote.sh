set -e
cd ~

# Права на сервере не выясняем заранее, а пробуем сами команды.
#
# Скрипт приезжает по ssh без терминала, и обычный sudo здесь не спросит
# пароль — скажет «a terminal is required» и упадёт. Отсюда всюду `sudo -n`:
# он либо срабатывает молча, либо отказывает сразу.
#
# А вот пробовать `sudo -n true` для проверки нельзя, хотя это и напрашивается:
# правило в sudoers обычно узкое, на одну-две команды, и права на `true` в нём
# нет. Проба сказала бы «sudo недоступен» там, где нужная команда разрешена.
# Поэтому проверка — это и есть попытка сделать дело.

# Корпус кладётся РЯДОМ с каталогом сайта, а не внутрь него. Внутри идут
# git pull, npm i и сборка, и git clean -fdx — обычный приём, когда сборка
# сломалась, — снёс бы 91 МБ разом у обоих разделов, которые его читают.
RULES_DIR=$(dirname "$RULES_DB_REMOTE")

if [ ! -d "$RULES_DIR" ] && ! sudo -n mkdir -p "$RULES_DIR" 2>/dev/null; then
    echo "нет каталога $RULES_DIR, и завести его отсюда нечем."
    echo "Один раз, из-под root на сервере:"
    echo "    mkdir -p $RULES_DIR && chown $(id -un) $RULES_DIR"
    exit 1
fi

if [ ! -w "$RULES_DIR" ] && ! sudo -n chown "$(id -un)" "$RULES_DIR" 2>/dev/null; then
    echo "каталог $RULES_DIR есть, но писать в него пользователем $(id -un) нельзя."
    echo "Один раз, из-под root на сервере, что-то одно:"
    echo "    chown $(id -un) $RULES_DIR"
    echo "    setfacl -m u:$(id -un):rwx $RULES_DIR"
    exit 1
fi

# Кладём рядом и подменяем одним движением: приложение держит файл открытым на
# чтение, и распаковывать поверх него значило бы читать полуразобранный корпус.
# mv в пределах одной файловой системы атомарен, старый открытый файл доживёт
# до перезапуска сам.
unzip -o rules-db.zip -d rules-db-new
mv rules-db-new/data.db "$RULES_DB_REMOTE.new"
mv "$RULES_DB_REMOTE.new" "$RULES_DB_REMOTE"
rm -rf rules-db-new rules-db.zip

echo "корпус на месте: $(ls -lh "$RULES_DB_REMOTE" | awk '{print $5}')"

# Приложение открывает файл один раз на процесс: пока его не перезапустят, оно
# читает СТАРЫЙ корпус по прежнему дескриптору, да и окружение (RULES_DB) берёт
# при запуске. Поэтому незавершённый перезапуск — не мелочь, а невыполненная
# выкладка, и молчать о нём нельзя.
if sudo -n systemctl restart typikon-web 2>/dev/null; then
    echo "сайт перезапущен, новый корпус в работе"
else
    echo
    echo "ФАЙЛ ДОЕХАЛ, НО САЙТ ЕЩЁ ЧИТАЕТ ПРЕЖНИЙ КОРПУС."
    echo "Заверши руками на сервере:"
    echo "    sudo systemctl restart typikon-web"
    echo
    echo "Чтобы это делалось само, одно правило (из-под root, /etc/sudoers.d/typikon):"
    echo "    $(id -un) ALL=(root) NOPASSWD: $(command -v systemctl) restart typikon-web, $(command -v systemctl) restart typikon-ordo"
    exit 1
fi

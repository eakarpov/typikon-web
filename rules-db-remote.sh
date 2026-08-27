set -e
cd ~

# Права на сервере спрашиваем, а не предполагаем.
#
# Скрипт приезжает по ssh без терминала, и обычный sudo здесь не спросит
# пароль — он просто скажет «a terminal is required» и упадёт. Поэтому всюду
# `sudo -n`: он либо срабатывает молча (когда правило NOPASSWD есть), либо
# сразу отказывает, и мы говорим, что именно нужно сделать руками один раз.
#
# Молча пропускать привилегированный шаг нельзя: файл-то доедет, а сайт
# продолжит читать прежний корпус, и выкладка будет выглядеть удавшейся.
CAN_SUDO=no
if sudo -n true 2>/dev/null; then CAN_SUDO=yes; fi

# Корпус кладётся РЯДОМ с каталогом сайта, а не внутрь него. Внутри идут
# git pull, npm i и сборка, и git clean -fdx — обычный приём, когда сборка
# сломалась, — снёс бы 91 МБ разом у обоих разделов, которые его читают.
# По той же причине не годится и домашний каталог: у файла два читателя, и
# оба — службы, а не человек.
RULES_DIR=$(dirname "$RULES_DB_REMOTE")

if [ ! -d "$RULES_DIR" ]; then
    if [ "$CAN_SUDO" = yes ]; then
        sudo -n mkdir -p "$RULES_DIR"
        sudo -n chown "$(id -un):$(id -gn)" "$RULES_DIR"
        echo "заведён $RULES_DIR"
    else
        echo "нет каталога $RULES_DIR, и завести его отсюда нечем."
        echo "Один раз, из-под root на сервере:"
        echo "    mkdir -p $RULES_DIR && chown $(id -un):$(id -gn) $RULES_DIR"
        echo
        echo "Либо укажи в .env.production такой RULES_DB, чей каталог уже"
        echo "принадлежит $(id -un) — лишь бы не внутри рабочего дерева git."
        exit 1
    fi
fi

if [ ! -w "$RULES_DIR" ]; then
    echo "каталог $RULES_DIR есть, но писать в него пользователем $(id -un) нельзя."
    echo "Один раз, из-под root на сервере, что-то одно:"
    echo "    chown $(id -un) $RULES_DIR          # отдать каталог целиком"
    echo "    setfacl -m u:$(id -un):rwx $RULES_DIR   # или только право записи"
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
# читает СТАРЫЙ корпус по прежнему дескриптору. Поэтому незавершённый
# перезапуск — это не мелочь, а невыполненная выкладка, и молчать о нём нельзя.
if [ "$CAN_SUDO" = yes ]; then
    sudo -n systemctl restart typikon-web
    echo "сайт перезапущен, новый корпус в работе"
else
    echo
    echo "ФАЙЛ ДОЕХАЛ, НО САЙТ ЕЩЁ ЧИТАЕТ ПРЕЖНИЙ КОРПУС."
    echo "Заверши руками на сервере:"
    echo "    sudo systemctl restart typikon-web"
    echo
    echo "Чтобы это делалось само, дай admin право на перезапуск без пароля"
    echo "(из-под root, visudo или файл в /etc/sudoers.d):"
    echo "    $(id -un) ALL=(root) NOPASSWD: /bin/systemctl restart typikon-web, /bin/systemctl restart typikon-ordo"
    exit 1
fi

set -e
cd ~

# Каталог общего состояния. Заводим здесь, а не руками при первой выкладке:
# скрипт должен быть самодостаточным, иначе однажды его запустят на чистом
# сервере и он молча упрётся в отсутствующий путь.
RULES_DIR=$(dirname "$RULES_DB_REMOTE")
if [ ! -d "$RULES_DIR" ]; then
    sudo mkdir -p "$RULES_DIR"
    sudo chown "$(id -un):$(id -gn)" "$RULES_DIR"
    echo "заведён $RULES_DIR"
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

# Приложение открывает файл один раз на процесс, поэтому новый корпус увидит
# только после перезапуска.
sudo systemctl restart typikon-web

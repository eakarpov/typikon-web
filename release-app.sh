#!/usr/bin/env bash
set -euo pipefail

# Заливка новой версии Android-приложения на прод.
# Использование:
#   bash release-app.sh 1.6.0 ~/Downloads/app-release.apk
#
# Требования (настраиваются один раз, вручную):
#   - на сервере существует /var/www/typikon-app-releases
#   - nginx отдаёт location /app/ из этой папки (alias)
#   - каталог доступен на запись пользователю admin (владелец) и на чтение всем (chmod 755),
#     чтобы nginx мог отдавать файлы независимо от того, под каким пользователем он запущен

if [ "$#" -ne 2 ]; then
    echo "Использование: bash release-app.sh <версия X.Y.Z> <путь к apk>" >&2
    exit 1
fi

VERSION="$1"
APK_PATH="$2"

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Версия должна быть в формате X.Y.Z, получено: $VERSION" >&2
    exit 1
fi

if [ ! -f "$APK_PATH" ]; then
    echo "Файл не найден: $APK_PATH" >&2
    exit 1
fi

export $(grep -v '^#' .env.release | xargs)

REMOTE_DIR="/var/www/typikon-app-releases"
VERSIONED_NAME="app-${VERSION}.apk"

echo "Заливаю $APK_PATH -> $REMOTE_DIR/$VERSIONED_NAME"
sshpass -f <(printf '%s\n' "$PASSWORD") ssh "$USERNAME@$HOST" "mkdir -p '$REMOTE_DIR'"
sshpass -f <(printf '%s\n' "$PASSWORD") scp "$APK_PATH" "$USERNAME@$HOST:$REMOTE_DIR/$VERSIONED_NAME"

echo "Обновляю текущую (app.apk -> $VERSIONED_NAME)"
sshpass -f <(printf '%s\n' "$PASSWORD") ssh "$USERNAME@$HOST" "cp '$REMOTE_DIR/$VERSIONED_NAME' '$REMOTE_DIR/app.apk'"

MAJOR="${VERSION%%.*}"
REST="${VERSION#*.}"
MINOR="${REST%%.*}"

VERSION_FILE="src/pages/api/v1/app/version.ts"
if [ -f "$VERSION_FILE" ]; then
    sed -i.bak -E "s/major: [0-9]+, minor: [0-9]+/major: $MAJOR, minor: $MINOR/" "$VERSION_FILE"
    rm -f "${VERSION_FILE}.bak"
    echo "Обновлён $VERSION_FILE -> major: $MAJOR, minor: $MINOR"
    echo "Не забудьте закоммитить и задеплоить веб (release.sh), чтобы /api/v1/app/version отдавал новую версию"
fi

echo "Готово: https://www.typikon.su/app/app.apk (версия $VERSION)"

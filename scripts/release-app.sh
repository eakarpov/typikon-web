#!/usr/bin/env bash
set -euo pipefail

# Заливка новой версии Android-приложения.
# Использование:
#   bash release-app.sh 1.6.0 ~/Downloads/app-release.apk
#   bash release-app.sh --target test 1.6.0 ~/Downloads/app-release.apk
#
# Ключ цели снимается с аргументов до проверки их числа (release-target.sh),
# поэтому версия и путь к apk остаются первым и вторым.
#
# Требования (настраиваются один раз, вручную):
#   - на сервере существует каталог сборок (APP_REMOTE, по умолчанию
#     /var/www/typikon-app-releases)
#   - nginx отдаёт location /app/ из этой папки (alias)
#   - каталог доступен на запись пользователю admin (владелец) и на чтение всем (chmod 755),
#     чтобы nginx мог отдавать файлы независимо от того, под каким пользователем он запущен

. "$(dirname "$0")/release-target.sh"

if [ "$#" -ne 2 ]; then
    echo "Использование: bash release-app.sh [--target КЛЮЧ] <версия X.Y.Z> <путь к apk>" >&2
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

REMOTE_DIR="$APP_REMOTE"
VERSIONED_NAME="app-${VERSION}.apk"

echo "Заливаю $APK_PATH -> $REMOTE_DIR/$VERSIONED_NAME"
ssh_run "mkdir -p '$REMOTE_DIR'"
scp_put "$APK_PATH" "$REMOTE_DIR/$VERSIONED_NAME"

echo "Обновляю текущую (app.apk -> $VERSIONED_NAME)"
ssh_run "cp '$REMOTE_DIR/$VERSIONED_NAME' '$REMOTE_DIR/app.apk'"

# API читает общий каталог APK через lib/appVersion; исходники обработчика v1
# при загрузке файла не меняются. При смене каталога задайте APP_RELEASES_DIR сайту.
echo "API определит версию по каталогу APK (обновление памяти занимает до минуты)"

echo "Готово: $SITE_URL/app/app.apk (версия $VERSION)"

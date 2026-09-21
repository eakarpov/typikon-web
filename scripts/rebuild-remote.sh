# Пересборка сайта на сервере. Запускается release.sh, руками не нужен.
set -e
cd "${REMOTE_ROOT:?не сказано, где сайт — скрипт запускается из release.sh}"

git checkout master
git pull
npm ci
NODE_ENV=production npm run build
sudo systemctl restart typikon-web.service

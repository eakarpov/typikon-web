# Пересборка сайта на сервере. Запускается release.sh, руками не нужен.
set -e
cd "${REMOTE_ROOT:?не сказано, где сайт — скрипт запускается из release.sh}"

git checkout master
git pull
npm ci
# Предел кучи сборке. Без него Node берёт столько, сколько видит, и на машине,
# где рядом живёт база, ядро выбирает жертвой её: mongod падает, а следующая
# сборка обрывается на ECONNREFUSED 127.0.0.1:27017.
#
# Предел на ПРОЦЕСС, а не на сборку целиком: next build отдаёт отрисовку страниц
# отдельным рабочим процессам, и NODE_OPTIONS наследуется каждым. Сколько их —
# решает Next по числу ядер, поэтому настоящий потолок кратен этому числу.
# Если памяти всё равно не хватает, сокращать надо число рабочих
# (experimental.cpus в next.config.js), а не это значение.
NODE_OPTIONS=--max-old-space-size=2048 NODE_ENV=production npm run build
sudo systemctl restart typikon-web.service

cd typikon-web
git checkout master
git pull
npm i -f
npm run build
sudo systemctl restart typikon-web.service

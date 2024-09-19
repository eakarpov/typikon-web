cd typikon-web
git checkout master
git pull
npm i
npm run build
sudo systemctl restart typikon-web.service

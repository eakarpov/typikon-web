cd typikon-web
git checkout next14
git pull
npm i
npm run build
sudo systemctl restart typikon-web.service

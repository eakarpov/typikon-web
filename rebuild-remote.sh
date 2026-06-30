cd /var/www/typikon.su/typikon-web
git checkout master
git pull
npm i -f
NODE_ENV=production npm run build
sudo systemctl restart typikon-web.service

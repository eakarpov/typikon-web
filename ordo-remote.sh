set -e
cd ~

mkdir -p "$REMOTE_DIR"
unzip -o ordo.zip -d "$REMOTE_DIR"
rm -f ordo.zip

# Юнит ставим каждый раз: он короткий, а расходиться с тем, что в репозитории,
# ему незачем.
sudo cp ~/typikon-ordo.service /etc/systemd/system/typikon-ordo.service
rm -f ~/typikon-ordo.service
sudo systemctl daemon-reload
sudo systemctl enable typikon-ordo
sudo systemctl restart typikon-ordo

sleep 2
# Проверяем, что поднялась: молча упавшая служба выглядит на сайте так же,
# как «раздел не выложен», и разбираться пришлось бы долго.
if curl -sf -m 5 http://127.0.0.1:8767/services > /dev/null; then
    echo "служба устава отвечает"
else
    echo "служба устава НЕ отвечает — смотри journalctl -u typikon-ordo"
    exit 1
fi

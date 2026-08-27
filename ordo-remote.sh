set -e
cd ~

# Права спрашиваем, а не предполагаем — см. пояснение в rules-db-remote.sh.
CAN_SUDO=no
if sudo -n true 2>/dev/null; then CAN_SUDO=yes; fi

mkdir -p "$REMOTE_DIR"
unzip -o ordo.zip -d "$REMOTE_DIR"
rm -f ordo.zip
echo "код службы на месте: $REMOTE_DIR"

UNIT=/etc/systemd/system/typikon-ordo.service

if [ "$CAN_SUDO" != yes ]; then
    echo
    echo "КОД ДОЕХАЛ, НО СЛУЖБА НЕ ПЕРЕЗАПУЩЕНА: нет права выполнять systemctl."
    echo "Заверши руками на сервере, из-под root:"
    echo "    cp ~/typikon-ordo.service $UNIT"
    echo "    systemctl daemon-reload && systemctl enable --now typikon-ordo"
    echo
    echo "Чтобы дальше это делалось само, хватит одного правила (visudo):"
    echo "    $(id -un) ALL=(root) NOPASSWD: /bin/systemctl restart typikon-web, /bin/systemctl restart typikon-ordo"
    echo "Юнит при этом ставится один раз, руками: менять его приходится редко."
    exit 1
fi

# Юнит ставим каждый раз, когда можем: он короткий, а расходиться с тем, что
# лежит в репозитории, ему незачем.
sudo -n cp ~/typikon-ordo.service "$UNIT"
rm -f ~/typikon-ordo.service
sudo -n systemctl daemon-reload
sudo -n systemctl enable typikon-ordo
sudo -n systemctl restart typikon-ordo

sleep 2
# Проверяем, что поднялась: молча упавшая служба выглядит на сайте так же,
# как «раздел не выложен», и разбираться пришлось бы долго.
if curl -sf -m 5 http://127.0.0.1:8767/services > /dev/null; then
    echo "служба устава отвечает"
else
    echo "служба устава НЕ отвечает — смотри journalctl -u typikon-ordo"
    exit 1
fi

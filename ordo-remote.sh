set -e
cd ~

# Пути в правиле sudoers должны совпасть с тем, как sudo найдёт команду по
# своему secure_path, а не с тем, как её находит наш PATH. На системах с
# usr-merge это /bin/systemctl и /usr/bin/systemctl — один и тот же файл под
# двумя именами, и какое из них подставит sudo, заранее не угадать.
# Поэтому перечисляем оба: лишнее правило безвредно, несовпавшее — нет.
sudoers_paths() {
    for p in /bin/systemctl /usr/bin/systemctl; do
        [ -e "$p" ] && printf '%s restart typikon-web, %s restart typikon-ordo, ' "$p" "$p"
    done | sed 's/, $//'
}


# Права не выясняем заранее, а пробуем сами команды — почему именно так,
# сказано в rules-db-remote.sh.

# Архив приезжает в домашний каталог, а не сразу сюда: каталога назначения
# при первой выкладке ещё нет, и scp в него не прошёл бы. Живёт архив секунды
# и удаляется ниже — постоянного в домашнем каталоге не остаётся ничего.
mkdir -p "$REMOTE_DIR"
unzip -o ordo.zip -d "$REMOTE_DIR"
rm -f ordo.zip
echo "код службы на месте: $REMOTE_DIR"

UNIT=/etc/systemd/system/typikon-ordo.service
SYSTEMCTL=$(command -v systemctl)

# Юнит ставим, когда можем. Не смогли — не беда, если он уже стоит: меняется
# он редко, и обычная выкладка кода в нём не нуждается. Беда, только если его
# нет вовсе, — тогда службу нечем запускать.
if sudo -n cp ~/typikon-ordo.service "$UNIT" 2>/dev/null; then
    rm -f ~/typikon-ordo.service
    sudo -n systemctl daemon-reload 2>/dev/null || true
    sudo -n systemctl enable typikon-ordo 2>/dev/null || true
    echo "юнит установлен"
elif [ -f "$UNIT" ]; then
    echo "юнит на месте, переставить не дали — и не нужно: он не менялся"
else
    echo
    echo "КОД ДОЕХАЛ, НО ЗАПУСКАТЬ ЕГО НЕЧЕМ: юнита нет, а поставить его нельзя."
    echo "Один раз, из-под root на сервере:"
    echo "    cp ~/typikon-ordo.service $UNIT"
    echo "    systemctl daemon-reload && systemctl enable --now typikon-ordo"
    exit 1
fi

if ! sudo -n systemctl restart typikon-ordo 2>/dev/null; then
    echo
    echo "КОД ДОЕХАЛ, НО СЛУЖБА НЕ ПЕРЕЗАПУЩЕНА — работает прежняя."
    echo "Заверши руками на сервере:"
    echo "    sudo systemctl restart typikon-ordo && sudo systemctl restart typikon-web"
    echo
    echo "Чтобы это делалось само, одно правило (из-под root, /etc/sudoers.d/typikon):"
    echo "    $(id -un) ALL=(root) NOPASSWD: $(sudoers_paths)"
    exit 1
fi

sleep 2
# Спрашиваем службу, поднялась ли она: молча упавшая выглядит на сайте так же,
# как «раздел не выложен», и разбираться пришлось бы долго.
if curl -sf -m 5 http://127.0.0.1:8767/services > /dev/null; then
    echo "служба устава отвечает"
else
    echo "служба устава НЕ отвечает — смотри journalctl -u typikon-ordo"
    exit 1
fi

# Сайт читает окружение при запуске, а мы его только что заменили: без
# перезапуска он не увидит ORDO_SERVICE_URL и решит, что службы нет.
if sudo -n systemctl restart typikon-web 2>/dev/null; then
    echo "сайт перезапущен"
else
    echo "СЛУЖБА РАБОТАЕТ, НО САЙТ ЕЩЁ НЕ ЗНАЕТ ЕЁ АДРЕСА."
    echo "Заверши руками:  sudo systemctl restart typikon-web"
    exit 1
fi

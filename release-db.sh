# Доставка базы сайта на сервер — ПО ЧАСТЯМ.
#
# Раньше ехало одним куском: mongodump всей базы, один архив на 62 МБ, один
# ssh-сеанс, внутри которого распаковка 300 МБ и mongorestore с пересборкой
# индексов на 260 тысяч записей. Сеанс до конца не доживал: рвался по таймауту,
# и выкладка обрывалась на середине — база на проде оставалась наполовину новой,
# а что именно доехало, а что нет, выяснялось только руками.
#
# Теперь каждая тяжёлая коллекция едет своим scp и своим ssh. Сеанс живёт минуту
# или две вместо десятков минут, а оборвался — повторяется ОДНА часть, а не всё:
#
#     bash release-db.sh                  # все части подряд
#     bash release-db.sh bible_verses     # только её — после обрыва
#     bash release-db.sh texts rest       # несколько названных
#
# Части независимы: каждая накатывается своим mongorestore --drop, и порядок
# между ними ничем не связан. Оттого повтор одной части безопасен и полон.

set -e

export $(grep -v '^#' .env.release | xargs)

REMOTE=/var/www/typikon.su/typikon-web

# Молчащий ssh — это ровно то, обо что спотыкалась прежняя выкладка: пока
# mongorestore возится с индексами, в канале тишина, и сеанс закрывают как
# бездействующий. Keepalive шлёт пустое каждые полминуты и держит его живым.
SSH_OPTS="-o ServerAliveInterval=30 -o ServerAliveCountMax=10"

# Тяжёлые коллекции — каждая своей частью, от большей к меньшей: если сеть
# сегодня плоха, это выяснится на первой же части, а не на пятой.
#
#   dneslov_names  117 МБ    bible_verses  76 МБ
#   texts           48 МБ    temples       46 МБ
#   всё остальное   11 МБ
HEAVY="dneslov_names bible_verses texts temples"

# ПРИХОДСКОЕ НЕ ВЕЗЁМ.
#
# Эти коллекции наполняются на проде — приходами, а не нами: у нас локально они
# пустые все до одной (см. src/lib/parish/*, писать в них умеет только сайт).
# А mongorestore --drop сносит всякую коллекцию, которая есть в дампе, включая
# пустую: пустой parishSettings.bson стирал бы приходам часовые пояса и их
# собственные правила, templeClaims — неразобранные заявки на храмы,
# templeAdmins — права, по которым приход вообще входит в свою страницу.
#
# Это не «забыли перечислить», а решение: их место на проде, и оттуда их берёт
# npm run sync:db, а не наоборот.
PARISH="parishSettings parishEdits parishSchedules templeClaims templeAdmins"

ssh_run() { sshpass -f <(printf '%s\n' $PASSWORD) ssh $SSH_OPTS $USERNAME@$HOST "$@"; }
scp_put() { sshpass -f <(printf '%s\n' $PASSWORD) scp $SSH_OPTS "$1" $USERNAME@$HOST:"$2"; }

# Часть = дамп + архив + перегон + накат. Всё в одной функции, чтобы «часть»
# была одним понятием, а не четырьмя шагами, которые можно перепутать местами.
send_part() {
    part=$1; shift

    rm -rf "db-$part" "db-$part.zip"
    mongodump -d typikon -o "db-$part" --quiet "$@"
    zip -rqX "db-$part.zip" "db-$part"

    echo "  $part: $(du -h "db-$part.zip" | cut -f1)"
    scp_put "db-$part.zip" "$REMOTE/db-$part.zip"
    ssh_run "PART='$part' bash -s" < db-remote.sh

    rm -rf "db-$part" "db-$part.zip"
}

PARTS="$*"
[ -n "$PARTS" ] || PARTS="$HEAVY rest"

# Окружение везём один раз на всю выкладку, а не с каждой частью: оно крохотное,
# но пять лишних scp — это пять лишних поводов сеансу оборваться.
sshpass -f <(printf '%s\n' $PASSWORD) scp $SSH_OPTS .env.production $USERNAME@$HOST:$REMOTE/.env.production

for part in $PARTS; do
    case " $HEAVY " in
        *" $part "*)
            send_part "$part" -c "$part"
            continue
            ;;
    esac

    if [ "$part" = rest ]; then
        # Остаток — «всё, что не перечислено выше»: описываем его исключениями,
        # а не списком. Список пришлось бы дополнять при каждой новой коллекции,
        # и забытая в нём коллекция не доезжала бы молча.
        #
        # Только через `=`: раздельную форму (--excludeCollection texts) mongodump
        # принимает без единого слова и НЕ ИСКЛЮЧАЕТ ничего — проверено на 100.9.5.
        # С ней «остаток» оказывался полной базой, и приходское ехало вместе с ним.
        set --
        for c in $HEAVY $PARISH; do set -- "$@" "--excludeCollection=$c"; done
        send_part rest "$@"
        continue
    fi

    echo "неизвестная часть: $part"
    echo "  известны: $HEAVY rest"
    exit 1
done

echo "база доставлена: $PARTS"

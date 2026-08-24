#!/usr/bin/env bash
# Проверка доступности кандидатов на синтез речи (TTS) с текущей машины.
#
# Зачем: с прод-сервера не дотягивается api.telegram.org, и прежде чем закладываться
# на облачный синтез, нужно знать, что именно оттуда доступно, а что нет.
#
# Что делает: один безымянный GET на каждый хост. Ключи не нужны и не передаются,
# тела ответов не сохраняются, ничего не меняется. Ответ 401/403 — это УСПЕХ:
# он означает, что хост доступен и просит авторизацию.
#
# Запуск:
#   bash check-tts-endpoints.sh                    # обычная проверка
#   bash check-tts-endpoints.sh --proxy socks5://user:pass@host:port
#   bash check-tts-endpoints.sh --timeout 15
#   bash check-tts-endpoints.sh > tts-check.txt    # сохранить вывод целиком

CONNECT_TIMEOUT=7
TIMEOUT=12
PROXY=""
UA="typikon-tts-check/1.0"

while [ $# -gt 0 ]; do
    case "$1" in
        --proxy)   PROXY="$2"; shift 2 ;;
        --timeout) TIMEOUT="$2"; CONNECT_TIMEOUT="$2"; shift 2 ;;
        -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
        *)         echo "Неизвестный аргумент: $1"; exit 1 ;;
    esac
done

if ! command -v curl > /dev/null 2>&1; then
    echo "Нужен curl. Установите: sudo apt install curl"
    exit 1
fi

OK=()
BLOCKED=()
DNS=()
CERT=()

# name | url | комментарий
CANDIDATES=(
    "== Яндекс SpeechKit (основной кандидат) =="
    "Yandex TTS v1|https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize|синтез, REST; тот же хост отдаёт gRPC v3 на 443"
    "Yandex IAM|https://iam.api.cloud.yandex.net/iam/v1/tokens|получение токена по сервисному аккаунту"
    "Yandex operations|https://operation.api.cloud.yandex.net/|статусы асинхронных операций"
    "Yandex Object Storage|https://storage.yandexcloud.net/|куда кладётся результат async-синтеза"
    "Yandex STT|https://stt.api.cloud.yandex.net/|распознавание, если вдруг понадобится"

    "== Другие российские провайдеры =="
    "Sber SaluteSpeech|https://smartspeech.sber.ru/rest/v1/text:synthesize|синтез Сбера"
    "Sber OAuth|https://ngw.devices.sberbank.ru:9443/api/v2/oauth|авторизация Сбера, нестандартный порт"
    "T-Bank VoiceKit|https://api.tinkoff.ai/|gRPC, имя хоста уточнить"

    "== Западные (вероятно недоступны, но пусть будет факт) =="
    "OpenAI|https://api.openai.com/v1/models|есть TTS в API"
    "ElevenLabs|https://api.elevenlabs.io/v1/voices|"
    "Google TTS|https://texttospeech.googleapis.com/|"

    "== Офлайн-модели: нужен разовый доступ, чтобы скачать веса =="
    "Silero models|https://models.silero.ai/|русские голоса, дальше работает без сети"
    "Hugging Face|https://huggingface.co/|зеркало моделей"
    "GitHub|https://github.com/|релизы Piper и прочего"
    "GitHub releases CDN|https://objects.githubusercontent.com/|фактическая отдача файлов релизов"
    "PyPI|https://pypi.org/simple/|установка пакетов синтеза"

    "== Контрольные точки (для калибровки вывода) =="
    "Яндекс (есть ли сеть)|https://ya.ru/|если и это не отвечает — проблема шире TTS"
    "api.telegram.org|https://api.telegram.org/|известно недоступен, эталон блокировки"
)

explain() {
    case "$1" in
        6)  echo "DNS не разрешился" ;;
        7)  echo "соединение не установлено" ;;
        28) echo "таймаут" ;;
        35) echo "TLS оборвался (похоже на DPI)" ;;
        60) echo "сертификат не проверился" ;;
        56) echo "соединение сброшено при чтении" ;;
        0)  echo "" ;;
        *)  echo "curl exit $1" ;;
    esac
}

request() {
    curl -s -o /dev/null \
        --connect-timeout "$CONNECT_TIMEOUT" --max-time "$TIMEOUT" \
        ${PROXY:+--proxy "$PROXY"} \
        -A "$UA" \
        -w '%{http_code} %{remote_ip} %{time_total}' \
        "$@" 2>/dev/null
}

# Одиночный таймаут — плохое основание для вывода «заблокировано»: сеть моргает,
# а по этому отчёту принимается решение. Поэтому неудачную попытку повторяем,
# и только устойчивый отказ считаем отказом.
attempt() {
    local out rc i
    for i in 1 2 3; do
        out=$(request "$@"); rc=$?
        case $rc in
            0|60|6) echo "$out"; return $rc ;;  # ответ, вопрос сертификата или DNS — повтор не нужен
        esac
        [ $i -lt 3 ] && sleep 2
    done
    echo "$out"
    return $rc
}

probe() {
    local name="$1" url="$2" note="$3"
    local out rc http ip ttotal verdict detail

    out=$(attempt "$url"); rc=$?

    # Сертификат не проверился — это ещё не блокировка. У российских сервисов
    # цепочка часто от корневого центра Минцифры, которого нет в системном
    # хранилище. Повторяем без проверки, чтобы отличить «нет доступа» от
    # «доступ есть, но нужен корневой сертификат».
    if [ $rc -eq 60 ]; then
        out=$(attempt -k "$url"); rc=$?
        if [ $rc -eq 0 ]; then
            http=$(echo "$out" | cut -d' ' -f1)
            ttotal=$(echo "$out" | cut -d' ' -f3)
            printf '  %-22s %-13s %s\n' "$name" "ДОСТУПЕН*" "HTTP $http, ${ttotal}s — нужен корневой сертификат Минцифры"
            [ -n "$note" ] && printf '  %-22s %-13s %s\n' "" "" "$note"
            CERT+=("$name — HTTP $http, доступен, но нужен корневой сертификат")
            return
        fi
        rc=60
    fi

    if [ $rc -eq 0 ]; then
        http=$(echo "$out" | cut -d' ' -f1)
        ip=$(echo "$out" | cut -d' ' -f2)
        ttotal=$(echo "$out" | cut -d' ' -f3)
        verdict="ДОСТУПЕН"
        detail="HTTP $http, ${ttotal}s, $ip"
        OK+=("$name — HTTP $http")
    else
        verdict="НЕТ"
        detail="$(explain $rc), 3 попытки"
        if [ $rc -eq 6 ]; then
            DNS+=("$name")
        else
            BLOCKED+=("$name — $(explain $rc)")
        fi
    fi

    printf '  %-22s %-13s %s\n' "$name" "$verdict" "$detail"
    [ -n "$note" ] && printf '  %-22s %-13s %s\n' "" "" "$note"
}

echo "Проверка доступности TTS-эндпоинтов"
echo "хост: $(hostname), дата: $(date '+%Y-%m-%d %H:%M:%S %Z')"
[ -n "$PROXY" ] && echo "через прокси: $PROXY"
echo "таймауты: соединение ${CONNECT_TIMEOUT}s, всего ${TIMEOUT}s"
echo

for entry in "${CANDIDATES[@]}"; do
    case "$entry" in
        "=="*)
            echo
            echo "$entry"
            ;;
        *)
            IFS='|' read -r name url note <<< "$entry"
            probe "$name" "$url" "$note"
            ;;
    esac
done

echo
echo "──────────────────────────────────────────────────────────"
echo "КАК ЧИТАТЬ"
echo "  ДОСТУПЕН + HTTP 401/403/400/404 — это успех: хост отвечает,"
echo "    просто мы пришли без ключа. Для наших целей этого достаточно."
echo "  ДОСТУПЕН* — соединение проходит, но системе не с чем проверить"
echo "    сертификат. Блокировкой это не является, лечится установкой"
echo "    корневого сертификата Минцифры на сервер."
echo "  «соединение не установлено» / «таймаут» / «TLS оборвался»"
echo "    — похоже на блокировку, тот же почерк, что у api.telegram.org."
echo "  «DNS не разрешился» — сначала проверьте, верное ли имя хоста;"
echo "    это может быть моя ошибка в списке, а не блокировка."
echo
echo "СВОДКА"
echo "  доступны (${#OK[@]}):"
for x in "${OK[@]}"; do echo "    + $x"; done
if [ ${#CERT[@]} -gt 0 ]; then
    echo "  доступны, но нужен корневой сертификат (${#CERT[@]}):"
    for x in "${CERT[@]}"; do echo "    ~ $x"; done
fi
echo "  не отвечают (${#BLOCKED[@]}):"
for x in "${BLOCKED[@]}"; do echo "    - $x"; done
if [ ${#DNS[@]} -gt 0 ]; then
    echo "  не разрешилось имя (${#DNS[@]}) — проверить сам хост:"
    for x in "${DNS[@]}"; do echo "    ? $x"; done
fi
echo
echo "Если Яндекс доступен, следующий шаг — не код, а пилот:"
echo "озвучить 5–10 текстов и дать послушать тем, для кого это делается."

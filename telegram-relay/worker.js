// Прозрачный релей для Telegram Bot API — на случай, если api.telegram.org недоступен
// напрямую с сервера (блокировка у хостера/региона). Просто перекладывает запрос на
// api.telegram.org и возвращает ответ как есть, ничего не меняя и не логируя.
//
// Деплой (через дашборд Cloudflare, без установки чего-либо):
//   1. https://dash.cloudflare.com -> Workers & Pages -> Create -> Create Worker
//   2. Вставить этот файл целиком в редактор кода, Deploy
//   3. Скопировать выданный адрес вида https://<имя>.<аккаунт>.workers.dev
//   4. В .env.production сервера typikon-web добавить:
//        TELEGRAM_API_BASE=https://<имя>.<аккаунт>.workers.dev
//      (без слэша на конце)
//
// Токен бота в этом воркере нигде не хранится — он приходит от вызывающей стороны
// прямо в пути запроса (/bot<token>/<method>), как и при прямом обращении к Telegram.
export default {
    async fetch(request) {
        const url = new URL(request.url);

        if (!url.pathname.startsWith("/bot")) {
            return new Response("Not found", { status: 404 });
        }

        const targetUrl = `https://api.telegram.org${url.pathname}${url.search}`;

        const response = await fetch(targetUrl, {
            method: request.method,
            headers: request.headers,
            body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
        });

        return new Response(response.body, {
            status: response.status,
            headers: response.headers,
        });
    },
};

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { countV1Request, deprecationHeaders } from "@/lib/api/v1Deprecation";
import { legacyHostHeaders } from "@/lib/migration";
import { isLegacyHost } from "@/utils/site";

export function middleware(request: NextRequest) {
    // ПЕРЕЕЗД (временно, до середины января). Чужая программа с ключом не
    // увидит ни новости, ни полосы на странице — ей говорят заголовками ответа.
    // Смотрим ХОСТ ЗАПРОСА, а не SITE_URL: приложение отвечает с обоих адресов,
    // и пришедшему на новый эти заголовки не нужны.
    const legacy = isLegacyHost(request.headers.get("host"));
    // Первая версия API объявлена устаревшей: помечаем ответы стандартными
    // заголовками и считаем, кто ещё ею пользуется. Отдельная ветка нужна потому,
    // что v1 — это 39 обработчиков в pages-роутере, и обвешивать каждый вручную
    // значило бы гарантированно про какой-нибудь забыть.
    if (request.nextUrl.pathname.startsWith("/api/v1")) {
        countV1Request(request.headers);

        const response = NextResponse.next();
        for (const [name, value] of Object.entries(deprecationHeaders())) {
            response.headers.set(name, value);
        }
        if (legacy) {
            for (const [name, value] of Object.entries(legacyHostHeaders())) {
                response.headers.set(name, value);
            }
        }
        return response;
    }

    if (legacy && request.nextUrl.pathname.startsWith("/api/")) {
        const response = NextResponse.next();
        for (const [name, value] of Object.entries(legacyHostHeaders())) {
            response.headers.set(name, value);
        }
        return response;
    }

    const headers = new Headers(request.headers);
    headers.set("x-current-path", request.nextUrl.pathname);
    return NextResponse.next({ headers });
}

export const config = {
    matcher: [
        // Страницы — ради заголовка x-current-path.
        "/((?!api|_next/static|_next/image|favicon.ico).*)",
        // И отдельно API — ради заголовков устаревания у первой версии, учёта
        // её клиентов и, до середины января, заголовков о переезде на всех ручках.
        "/api/:path*",
    ],
};

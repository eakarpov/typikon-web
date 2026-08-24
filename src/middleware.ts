import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { countV1Request, deprecationHeaders } from "@/lib/api/v1Deprecation";

export function middleware(request: NextRequest) {
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
        // И отдельно первая версия API — ради заголовков устаревания и учёта клиентов.
        "/api/v1/:path*",
    ],
};

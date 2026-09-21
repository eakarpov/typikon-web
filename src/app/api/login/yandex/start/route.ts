import {NextRequest, NextResponse} from "next/server";
import {randomBytes} from "node:crypto";
import {buildYandexAuthorizeUrl, isYandexConfigured} from "@/lib/authorize/yandex";
import {safeNextPath} from "@/lib/authorize/redirect";

// Начало разговора с Яндексом — и для входа, и для привязки в профиле.
//
// Обычная ссылка, а не сценарий на странице: у Яндекса всё идёт переходом на его
// сайт и возвратом, и делать вид, что это кнопка внутри страницы, незачем —
// работает и без JavaScript.
//
// `mode=link` отличает привязку от входа. Он едет в cookie, а не в `state`:
// state сверяется побайтно и служит одному — доказать, что вернулись оттуда же,
// куда уходили; мешать в него полезную нагрузку значило бы разбирать её до
// проверки.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const link = request.nextUrl.searchParams.get("mode") === "link";

    if (!isYandexConfigured()) {
        return NextResponse.redirect(new URL(link ? "/profile?link=off" : "/login?error=yandex-off", request.url));
    }

    // Проверочная строка против подделки запроса: вернувшийся код принимается
    // только вместе с нею, и завести её мог лишь тот, кто начинал здесь.
    const state = randomBytes(16).toString("hex");
    const asked = request.nextUrl.searchParams.get("next");
    const next = asked ? safeNextPath(asked) : (link ? "/profile" : "/");

    const response = NextResponse.redirect(buildYandexAuthorizeUrl(state));
    const options = {
        httpOnly: true,
        secure: true,
        sameSite: "lax" as const,
        path: "/",
        // Десять минут: столько занимает вход у Яндекса с набором пароля, а
        // висеть дольше этой паре незачем.
        maxAge: 600,
    };
    response.cookies.set("yandex_state", state, options);
    response.cookies.set("yandex_next", next, options);
    response.cookies.set("yandex_mode", link ? "link" : "login", options);
    return response;
}

import {NextRequest, NextResponse} from "next/server";
import {timingSafeEqual} from "node:crypto";
import {exchangeYandexCode, fetchYandexUserId, isYandexConfigured} from "@/lib/authorize/yandex";
import {getUserByYandexId, registerNewUserWithYandex} from "@/lib/authorize/users";
import {createNewSession, getSession} from "@/lib/authorize/sessions";
import {linkProvider} from "@/lib/authorize/link";
import {safeNextPath} from "@/lib/authorize/redirect";

// Возврат от Яндекса. Сюда приходит одноразовый код; токен добывается обменом
// на сервере (почему именно так — в lib/authorize/yandex).
//
// Два исхода по cookie `yandex_mode`: вход (завести сессию) и привязка к уже
// открытой записи (дописать идентификатор в неё). Общего у них всё до того
// места, где становится известно, кто пришёл.
export const dynamic = "force-dynamic";

const sameString = (a: string, b: string): boolean => {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    return left.length === right.length && timingSafeEqual(left, right);
};

export async function GET(request: NextRequest) {
    const params = request.nextUrl.searchParams;
    const link = request.cookies.get("yandex_mode")?.value === "link";
    const next = safeNextPath(request.cookies.get("yandex_next")?.value) || "/";

    const clear = (response: NextResponse) => {
        response.cookies.delete("yandex_state");
        response.cookies.delete("yandex_next");
        response.cookies.delete("yandex_mode");
        return response;
    };

    // Причина уезжает в адрес страницы, а не в тело ответа: человек
    // возвращается сюда переходом, и показать ему нужно страницу. У входа это
    // страница входа, у привязки — та, с которой он ушёл.
    const fail = (code: string) => {
        const url = link ? new URL(next, request.url) : new URL("/login", request.url);
        url.searchParams.set(link ? "link" : "error", code);
        return clear(NextResponse.redirect(url));
    };

    if (!isYandexConfigured()) return fail(link ? "off" : "yandex-off");
    // Отказ на стороне Яндекса — не ошибка: человек передумал.
    if (params.get("error")) return fail(link ? "denied" : "yandex-denied");

    const code = params.get("code");
    const state = params.get("state");
    const saved = request.cookies.get("yandex_state")?.value;
    if (!code || !state || !saved || !sameString(state, saved)) return fail(link ? "state" : "yandex-state");

    const token = await exchangeYandexCode(code);
    if (!token) return fail(link ? "exchange" : "yandex-exchange");

    const yandexId = await fetchYandexUserId(token);
    if (!yandexId) return fail(link ? "info" : "yandex-info");

    if (link) {
        // Привязка идёт из-под уже открытой сессии: сперва человек доказал, что
        // запись его, и лишь потом присоединяет к ней новый вход.
        const sessionDb = await getSession();
        if (!sessionDb?.id) return fail("nosession");

        const outcome = await linkProvider(sessionDb.id, "Yandex", yandexId);
        const url = new URL(next, request.url);
        url.searchParams.set("link", outcome === "already-yours" ? "ok" : outcome);
        return clear(NextResponse.redirect(url));
    }

    let user = await getUserByYandexId(yandexId);
    if (!user) {
        await registerNewUserWithYandex(yandexId);
        user = await getUserByYandexId(yandexId);
    }
    if (!user?._id) return fail("server");

    await createNewSession(user._id.toString(), { user_id: yandexId }, "", "", "Yandex");

    return clear(NextResponse.redirect(new URL(next, request.url)));
}

import { authorizeUser } from "@/lib/api/v2/user";
import { fail, respondPrivate } from "@/lib/api/v2/http";
import { forgetDevice, knownTimeZone, rememberDevice } from "@/lib/push/devices";
import { reportError } from "@/lib/reportError";

// КУДА СТУЧАТЬСЯ ТЕЛЕФОНУ.
//
// Личное вдвойне: и сам факт, что у этого человека есть помянник, и ключ
// доставки — по нему телефон опознаётся. Отсюда `respondPrivate` и сессия:
// привязать чужой телефон к своему помяннику нельзя, и свой к чужому тоже.
//
// **Имён здесь не появляется.** Толчок, который потом уйдёт на это устройство,
// пуст: он будит приложение, а что сказать — приложение решает само, по своему
// зеркалу. См. `lib/push/devices`.
export const dynamic = "force-dynamic";

const MAX_TOKEN = 4096;

export async function POST(request: Request) {
    const access = await authorizeUser(request, "pomyannik");
    if (access.denied) return access.denied;

    let body: any;
    try {
        body = await request.json();
    } catch {
        return fail("bad_request", "Тело запроса — объект JSON.");
    }

    const token = typeof body?.token === "string" ? body.token.trim() : "";
    if (!token || token.length > MAX_TOKEN) {
        return fail("bad_request", "Нужен ключ доставки в поле token.");
    }

    // Пояс идёт в расчёт времени, и чужую строку туда пускать нельзя: `Intl`
    // на неизвестном поясе бросает, и рассылка легла бы целиком из-за одного
    // устройства.
    const timeZone = typeof body?.timeZone === "string" ? body.timeZone : "";
    if (!timeZone || !knownTimeZone(timeZone)) {
        return fail("bad_request", "Нужен часовой пояс устройства (IANA) в поле timeZone.");
    }

    const platform = body?.platform === "ios" ? "ios" : "android";

    try {
        await rememberDevice(access.userId, token, timeZone, platform);
        return respondPrivate({ ok: true }, { access });
    } catch (e) {
        reportError(e, { where: "app/api/v2/pomyannik/devices/route#POST", source: "api" });
        return fail("internal", "Не удалось запомнить устройство.");
    }
}

export async function DELETE(request: Request) {
    const access = await authorizeUser(request, "pomyannik");
    if (access.denied) return access.denied;

    const token = new URL(request.url).searchParams.get("token")?.trim() ?? "";
    if (!token) return fail("bad_request", "Нужен ключ доставки в параметре token.");

    try {
        // Не нашлось — тоже успех: выключить уведомления дважды не ошибка, а
        // `404` заставил бы приложение это различать без всякой пользы.
        await forgetDevice(access.userId, token);
        return respondPrivate({ ok: true }, { access });
    } catch (e) {
        reportError(e, { where: "app/api/v2/pomyannik/devices/route#DELETE", source: "api" });
        return fail("internal", "Не удалось забыть устройство.");
    }
}

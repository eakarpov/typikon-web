import {
    getUserByGoogleId, getUserByTelegramId,
    registerNewUserWithGoogle, registerNewUserWithTelegram,
} from "@/lib/authorize/users";
import {createNewSession} from "@/lib/authorize/sessions";
import {verifyGoogleIdToken} from "@/lib/authorize/verifyGoogleToken";
import {verifyTelegramAuth} from "@/lib/authorize/telegram";
import {NextRequest, NextResponse} from "next/server";
import type {Provider} from "@/lib/authorize/providers";

// Общее правило обеих веток: идентификатор пользователя сервер получает от
// провайдера — из проверенного токена Google, из подписанных полей Telegram — и
// никогда из тела запроса.
//
// Яндекса здесь нет, и это не забывчивость: его вход идёт кодом авторизации
// через /api/login/yandex, потому что принять от браузера его токен на веру
// нельзя (причина — в lib/authorize/yandex).
//
// VK убран. Учётные записи с `auth.vk` в базе остались, но войти по ним нечем:
// тип "VK" теперь отвечает 400, как всякий неизвестный.

const enter = async (
    provider: Provider,
    providerUserId: string,
    findUser: (id: string) => Promise<any>,
    registerUser: (id: string) => Promise<unknown>,
    deviceId: string,
) => {
    let user = await findUser(providerUserId);
    if (!user) {
        await registerUser(providerUserId);
        user = await findUser(providerUserId);
    }
    if (!user?._id) return new NextResponse(null, { status: 500 });

    const expiresAt = await createNewSession(
        user._id.toString(),
        { user_id: providerUserId },
        "",
        deviceId,
        provider,
    );
    return NextResponse.json({
        userId: user._id.toString(),
        expiresAt,
        provider,
    }, {
        status: 200,
        headers: {
            'Access-Control-Expose-Headers': 'Set-Cookie'
        }
    });
};

export async function POST(request: NextRequest) {
    // Тело не логируется: в нём приходит id_token Google и данные учётной записи.
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || !body.data || typeof body.data !== "object") {
        return new NextResponse(null, { status: 400 });
    }
    const deviceId = typeof body.deviceId === "string" ? body.deviceId.slice(0, 256) : "";

    if (body.type === "Google") {
        // data.access_token — это Google id_token (JWT), не OAuth access_token,
        // несмотря на название поля в существующем контракте запроса. Раньше
        // здесь напрямую доверяли body.data.user_id от клиента — подделать
        // произвольный user_id и войти под чужим Google-аккаунтом было тривиально.
        // Веб присылает сам токен строкой, приложение — тоже; форма {credential}
        // остаётся принятой ради уже выпущенных сборок.
        const idToken = typeof body.data.access_token === "string"
            ? body.data.access_token
            : body.data.access_token?.credential;
        if (typeof idToken !== "string") {
            return new NextResponse(null, { status: 401 });
        }
        const payload = await verifyGoogleIdToken(idToken);
        if (!payload?.sub) {
            return new NextResponse(null, { status: 401 });
        }
        return enter("Google", payload.sub, getUserByGoogleId, registerNewUserWithGoogle, deviceId);
    }

    if (body.type === "Telegram") {
        const check = verifyTelegramAuth(body.data.fields, process.env.TELEGRAM_BOT_TOKEN);
        if (!check.ok) {
            // Без токена бота вход не «неверен», а выключен — это видно по коду ответа.
            return new NextResponse(null, { status: check.reason === "no-token" ? 503 : 401 });
        }
        return enter("Telegram", check.userId, getUserByTelegramId, registerNewUserWithTelegram, deviceId);
    }

    return new NextResponse(null, { status: 400 });
}

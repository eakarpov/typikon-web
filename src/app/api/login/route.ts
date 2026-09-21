import {
    getUserByGoogleId, getUserByTelegramId,
    getUserByVKId,
    registerNewUserWithGoogle, registerNewUserWithTelegram,
    registerNewUserWithVK
} from "@/lib/authorize/users";
import {createNewSession} from "@/lib/authorize/sessions";
import {verifyGoogleIdToken} from "@/lib/authorize/verifyGoogleToken";
import {verifyVkAccessToken} from "@/lib/authorize/verifyVkToken";
import {verifyTelegramAuth} from "@/lib/authorize/telegram";
import {NextRequest, NextResponse} from "next/server";

// Общее правило всех трёх веток: идентификатор пользователя сервер получает от
// провайдера — из ответа VK, из проверенного токена Google, из подписанных полей
// Telegram — и никогда из тела запроса. В сессию кладётся только то, что нужно
// потом (у VK — токен продления), а не всё присланное.

export async function POST(request: NextRequest) {
    // Тело не логируется: в нём приходит id_token Google и данные учётной записи.
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || !body.data || typeof body.data !== "object") {
        return new NextResponse(null, { status: 400 });
    }
    const deviceId = typeof body.deviceId === "string" ? body.deviceId.slice(0, 256) : "";

    if (body.type === "VK") {
        const vkUserId = await verifyVkAccessToken(body.data.access_token);
        if (!vkUserId) {
            return new NextResponse(null, { status: 401 });
        }
        let user = await getUserByVKId(vkUserId);
        if (!user) {
            // register
            await registerNewUserWithVK(vkUserId);
            user =  await getUserByVKId(vkUserId);
        }
        // 3. Store the session in cookies for optimistic auth checks
        const expiresAt = await createNewSession(
            user!._id?.toString(),
            {
                refresh_token: typeof body.data.refresh_token === "string" ? body.data.refresh_token : undefined,
                user_id: vkUserId,
            },
            "" as string,
            deviceId,
            "VK",
            Number(body.data.expires_in),
        );
        return NextResponse.json({
            userId: user!._id?.toString(),
            expiresAt,
            isVK: true,
        }, {
            status: 200,
            headers: {
                'Access-Control-Expose-Headers': 'Set-Cookie'
            }
        });
    } else if (body.type === "Google") {
        // data.access_token — это Google id_token (JWT), не OAuth access_token,
        // несмотря на название поля в существующем контракте запроса. Раньше
        // здесь напрямую доверяли body.data.user_id от клиента — подделать
        // произвольный user_id и войти под чужим Google-аккаунтом было тривиально.
        // Веб присылает ответ Google Identity Services целиком ({credential}),
        // приложение — сам токен строкой; годится и то и другое.
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
        let user = await getUserByGoogleId(payload.sub);
        if (!user) {
            // register
            await registerNewUserWithGoogle(payload.sub);
            user = await getUserByGoogleId(payload.sub);
        }
        // 3. Store the session in cookies for optimistic auth checks
        const expiresAt = await createNewSession(
            user!._id?.toString(),
            { user_id: payload.sub },
            "" as string,
            deviceId,
            "Google",
        );
        return NextResponse.json({
            userId: user!._id?.toString(),
            expiresAt,
            isGoogle: true,
        }, {
            status: 200,
            headers: {
                'Access-Control-Expose-Headers': 'Set-Cookie'
            }
        });
    }  else if (body.type === "Telegram") {
        const check = verifyTelegramAuth(body.data.fields, process.env.TELEGRAM_BOT_TOKEN);
        if (!check.ok) {
            // Без токена бота вход не «неверен», а выключен — это видно по коду ответа.
            return new NextResponse(null, { status: check.reason === "no-token" ? 503 : 401 });
        }

        let user = await getUserByTelegramId(check.userId);
        if (!user) {
            // register
            await registerNewUserWithTelegram(check.userId);
            user = await getUserByTelegramId(check.userId);
        }
        // 3. Store the session in cookies for optimistic auth checks
        const expiresAt = await createNewSession(
            user!._id?.toString(),
            { user_id: check.userId },
            "" as string,
            deviceId,
            "Telegram",
        );
        return NextResponse.json({
            userId: user!._id?.toString(),
            expiresAt,
            isTelegram: true,
        }, {
            status: 200,
            headers: {
                'Access-Control-Expose-Headers': 'Set-Cookie'
            }
        });
    } else {
        return new NextResponse(null, {
            status: 400,
        });
    }
}

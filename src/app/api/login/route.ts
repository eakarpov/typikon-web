import {
    getUserByGoogleId, getUserByTelegramId,
    getUserByVKId,
    registerNewUserWithGoogle, registerNewUserWithTelegram,
    registerNewUserWithVK
} from "@/lib/authorize/users";
import {createNewSession} from "@/lib/authorize/sessions";
import * as sha256 from "fast-sha256";
import {NextRequest, NextResponse} from "next/server";

function toHex(buffer: Uint8Array): string {
    return Array.prototype.map.call(buffer, x => ('00' + x.toString(16)).slice(-2)).join('');
}

export async function POST(request: NextRequest) {
    const body = await request.json();
    console.log(body);
    // const body = req;
    // const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    if (body.type === "VK") {
        let user = await getUserByVKId(body.data.user_id);
        if (!user) {
            // register
            await registerNewUserWithVK(body.data.user_id);
            user =  await getUserByVKId(body.data.user_id);
        }
        // 3. Store the session in cookies for optimistic auth checks
        const expiresAt = await createNewSession(
            user!._id?.toString(),
            body.data,
            "" as string,
            body.timestamp,
            body.deviceId,
            "VK",
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
        let user = await getUserByGoogleId(body.data.user_id);
        if (!user) {
            // register
            await registerNewUserWithGoogle(body.data.user_id);
            user = await getUserByGoogleId(body.data.user_id);
        }
        // 3. Store the session in cookies for optimistic auth checks
        const expiresAt = await createNewSession(
            user!._id?.toString(),
            body.data,
            "" as string,
            body.timestamp,
            body.deviceId,
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
        const encoder = new TextEncoder();
        const secret_key = sha256.default(encoder.encode(process.env.TELEGRAM_BOT_TOKEN!))
        if (toHex(sha256.hmac(body.data.data_check_string, secret_key)) !== body.data.hash) {
            // Неверная проверка
            return new NextResponse(null, {
                status: 400,
            });
        }

        let user = await getUserByTelegramId(body.data.user_id);
        if (!user) {
            // register
            await registerNewUserWithTelegram(body.data.user_id);
            user = await getUserByTelegramId(body.data.user_id);
        }
        // 3. Store the session in cookies for optimistic auth checks
        const expiresAt = await createNewSession(
            user!._id?.toString(),
            body.data,
            "" as string,
            body.timestamp,
            body.deviceId,
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

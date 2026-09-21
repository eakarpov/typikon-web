import {NextRequest, NextResponse} from "next/server";
import {getSession} from "@/lib/authorize/sessions";
import {verifyGoogleIdToken} from "@/lib/authorize/verifyGoogleToken";
import {verifyTelegramAuth} from "@/lib/authorize/telegram";
import {
    currentLinks, linkProvider, unlinkProvider, unlinkVk,
    type LinkOutcome, type UnlinkOutcome,
} from "@/lib/authorize/link";
import {isProvider} from "@/lib/authorize/providers";

// Привязка и снятие входов в профиле.
//
// Чья запись правится, решает сессия, а не тело запроса. Идентификатор у
// провайдера проверяется ровно так же, как при входе: привязка не должна уметь
// того, чего не умеет /api/login.
//
// Яндекса здесь нет: его вход идёт переходом на его сайт и возвратом, поэтому
// и привязка идёт тем же путём — /api/login/yandex/start?mode=link.
export const dynamic = "force-dynamic";

/** Отказы различаются в ответе, чтобы страница сказала человеку, что именно не так. */
const STATUS: Record<LinkOutcome | UnlinkOutcome, number> = {
    "ok": 200,
    "already-yours": 200,
    "taken": 409,
    "occupied": 409,
    "absent": 409,
    "last": 409,
    "no-user": 401,
    "error": 500,
};

/**
 * Ответ несёт не только исход, но и новый состав привязок: страница обновляет
 * его у себя и ничего не перезагружает. Через router.refresh() было хуже —
 * обновление пересоздавало дерево и гасило только что показанное сообщение.
 */
const answer = async (userId: string, outcome: LinkOutcome | UnlinkOutcome) =>
    NextResponse.json({ outcome, links: await currentLinks(userId) }, { status: STATUS[outcome] });

export async function POST(request: NextRequest) {
    const sessionDb = await getSession();
    if (!sessionDb?.id) return new NextResponse(null, { status: 401 });

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || !body.data || typeof body.data !== "object") {
        return new NextResponse(null, { status: 400 });
    }

    if (body.type === "Google") {
        const idToken = typeof body.data.credential === "string" ? body.data.credential : null;
        if (!idToken) return new NextResponse(null, { status: 400 });
        const payload = await verifyGoogleIdToken(idToken);
        if (!payload?.sub) return NextResponse.json({ outcome: "rejected" }, { status: 401 });
        return answer(sessionDb.id, await linkProvider(sessionDb.id, "Google", payload.sub));
    }

    if (body.type === "Telegram") {
        const check = verifyTelegramAuth(body.data.fields, process.env.TELEGRAM_BOT_TOKEN);
        if (!check.ok) {
            return NextResponse.json({ outcome: "rejected" }, {
                status: check.reason === "no-token" ? 503 : 401,
            });
        }
        return answer(sessionDb.id, await linkProvider(sessionDb.id, "Telegram", check.userId));
    }

    return new NextResponse(null, { status: 400 });
}

export async function DELETE(request: NextRequest) {
    const sessionDb = await getSession();
    if (!sessionDb?.id) return new NextResponse(null, { status: 401 });

    const provider = request.nextUrl.searchParams.get("provider");

    // ВК снимается особой веткой: он не рабочий вход, и правило «последний не
    // снимается» к нему неприменимо (lib/authorize/link).
    if (provider === "VK") {
        return answer(sessionDb.id, await unlinkVk(sessionDb.id));
    }

    if (!isProvider(provider)) return new NextResponse(null, { status: 400 });

    return answer(sessionDb.id, await unlinkProvider(sessionDb.id, provider));
}

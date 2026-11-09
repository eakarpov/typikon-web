import {NextResponse} from "next/server";
import {getSession} from "@/lib/authorize/sessions";
import {getItem} from "@/app/profile/api";

// Сессия читается отдельным запросом с клиента, а не в корневом layout:
// обращение к cookies в layout делало динамическим рендер вообще всех страниц сайта.
export const dynamic = "force-dynamic";

export async function GET() {
    const active = await getSession();
    const session = active ? { isAuth: true, userId: active.id, expiresAt: active.expiresAt } : { isAuth: false };

    if (!session.isAuth) {
        const response = NextResponse.json({ isAuth: false }, {
            headers: { "Cache-Control": "no-store" },
        });
        response.cookies.delete("session");
        return response;
    }

    const [user] = await getItem(session.userId as string);

    return NextResponse.json({ ...session, user }, {
        headers: { "Cache-Control": "no-store" },
    });
}

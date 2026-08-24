import {NextResponse} from "next/server";
import {verifySession} from "@/lib/authorize/authorization";
import {getItem} from "@/app/profile/api";

// Сессия читается отдельным запросом с клиента, а не в корневом layout:
// обращение к cookies в layout делало динамическим рендер вообще всех страниц сайта.
export const dynamic = "force-dynamic";

export async function GET() {
    const session = await verifySession();

    if (!session.isAuth) {
        return NextResponse.json({ isAuth: false }, {
            headers: { "Cache-Control": "no-store" },
        });
    }

    const [user] = await getItem(session.userId as string);

    return NextResponse.json({ ...session, user }, {
        headers: { "Cache-Control": "no-store" },
    });
}

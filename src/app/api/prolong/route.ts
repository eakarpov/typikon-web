import {prolongSession} from "@/lib/authorize/sessions";
import {NextResponse} from "next/server";

// Продление входа.
//
// Прежде отсюда наружу отдавался токен продления VK, а продлевал вход уже
// браузер — обновлял токен у VK и заводил сессию заново. Продления у Google и
// Telegram такого рода нет вовсе, и вошедший через них просто терял вход через
// час. Теперь ручка не отдаёт ничего: она двигает окно НАШЕЙ сессии, и способ
// входа для этого знать не нужно.
export const dynamic = "force-dynamic";

export async function POST() {
    const expiresAt = await prolongSession();

    if (!expiresAt) {
        // Сессии нет, она кончилась или упёрлась в предел от начала входа.
        // Для страницы это значит «пора показать вход», а не «повтори запрос».
        return new NextResponse(null, { status: 401 });
    }

    return NextResponse.json({ expiresAt }, {
        headers: { "Cache-Control": "no-store" },
    });
}

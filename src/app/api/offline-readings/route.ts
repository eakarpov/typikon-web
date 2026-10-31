import { NextRequest, NextResponse } from 'next/server';
import { offlineDays } from '@/lib/offlineReadings';
import { calcDayCached } from '@/lib/api/v2/calendar';
import { consume, clientIpFromHeaders } from '@/lib/rateLimit';
import { BIBLE_LANGUAGE_COOKIE, DEFAULT_BIBLE_LANGUAGE } from '@/utils/bibleLanguage';
import { reportError } from '@/lib/reportError';
export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
    if (!consume(`offline-range:${clientIpFromHeaders(req.headers)}`, 10, 60).allowed)
        return new NextResponse(null, { status: 429 });
    const b = await req.json().catch(() => null), days = offlineDays(b?.from, b?.to);
    if (!days)
        return NextResponse.json({ error: 'Выберите от 1 до 31 дня, с 1900 по 2099 год.' }, { status: 400 });
    const lang = req.cookies.get(BIBLE_LANGUAGE_COOKIE)?.value || DEFAULT_BIBLE_LANGUAGE;
    try {
        const out = [];
        for (const date of days) {
            const result = await calcDayCached(date, lang);
            out.push({ date, title: result?.day?.name || `Чтения на ${date}`, available: !!result?.day });
        }
        return NextResponse.json({ days: out, lang }, { headers: { 'Cache-Control': 'no-store' } });
    }
    catch (e) {
        reportError(e, { where: 'offline-readings' });
        return NextResponse.json({ error: 'Не удалось собрать состав. Попробуйте ещё раз.' }, { status: 503 });
    }
}

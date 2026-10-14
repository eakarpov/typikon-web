import { fail, preflight, respond } from "@/lib/api/v2/http";
import { authorize } from "@/lib/api/v2/access";
import { daySaint } from "@/lib/api/v2/serialize";
import { daySaintsCached } from "@/lib/daySaints/store";
import { reportError } from "@/lib/reportError";

// Святые дня из нашего каталога: кого из святых вспоминают в этот день по Минее.
//
// Дата гражданская (YYYY-MM-DD); выборка идёт по церковной паре месяц+число
// ст. ст. — как у соседа /api/v2/calendar/{date}. Пасхалия не участвует:
// неподвижный круг адресуется числом месяца.
//
// Список строится по ВЫВЕРЕННЫМ человеком связкам «память → святой», и выверена
// меньшая часть (88 из 653): пустой список чаще значит «связь не проставлена»,
// чем «святых нет». Иконы, святыни, места и храмы не входят — это список лиц.
export const revalidate = 3600;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function OPTIONS() {
    return preflight();
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ date: string }> },
) {
    const access = await authorize(request, "calendar");
    if (access.denied) return access.denied;

    const { date } = await params;

    if (!DATE.test(date) || isNaN(new Date(date).getTime())) {
        return fail("bad_request", "Дата указывается в виде ГГГГ-ММ-ДД");
    }

    try {
        const saints = await daySaintsCached(date);
        return respond({ date, saints: saints.map(daySaint) }, { access });
    } catch (e) {
        reportError(e, { where: "app/api/v2/calendar/[date]/saints/route#GET", source: "api" });
        return fail("internal", "Не удалось собрать святых дня");
    }
}

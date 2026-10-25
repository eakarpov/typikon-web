import { fail, preflight, respond } from "@/lib/api/v2/http";
import { authorize } from "@/lib/api/v2/access";
import { daySaint } from "@/lib/api/v2/serialize";
import { daySaintsCached } from "@/lib/daySaints/store";
import { reportError } from "@/lib/reportError";

// Дневная выдача Днеслова из долговечного кэша + собственный каталог.
// Связки памяти с лицом дополняют источник, а не ограничивают его покрытие.
export const dynamic = "force-dynamic";
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
        const result = await daySaintsCached(date);
        return respond({ date, ...result, saints: result.saints.map(daySaint) },
            { access, maxAge: result.partial ? 0 : revalidate });
    } catch (e) {
        reportError(e, { where: "app/api/v2/calendar/[date]/saints/route#GET", source: "api" });
        return fail("internal", "Не удалось собрать святых дня");
    }
}

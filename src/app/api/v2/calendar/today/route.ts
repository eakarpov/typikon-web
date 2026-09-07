import { fail, preflight, respond } from "@/lib/api/v2/http";
import { authorize } from "@/lib/api/v2/access";
import { calcDayCached, calendarResponse, readLang } from "@/lib/api/v2/calendar";
import { formatDateISO } from "@/utils/dates";
import {reportError} from "@/lib/reportError";

// Сегодняшний день. «Сегодня» здесь гражданское: церковная дата и переход после
// вечерни считаются внутри и отдаются отдельным полем.
export const revalidate = 300;

export async function OPTIONS() {
    return preflight();
}

export async function GET(request: Request) {
    const access = await authorize(request, "calendar");
    if (access.denied) return access.denied;

    const today = formatDateISO(new Date());

    try {
        const result = await calcDayCached(today, readLang(new URL(request.url)));

        if (!result) {
            return fail("not_found", `На ${today} чтений не найдено`);
        }

        return respond(calendarResponse(today, result), { maxAge: 300, access });
    } catch (e) {
        reportError(e, { where: "app/api/v2/calendar/today/route#GET", source: "api" });
        return fail("internal", "Не удалось рассчитать день");
    }
}

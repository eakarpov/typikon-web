import { fail, preflight, respond } from "@/lib/api/v2/http";
import { limitOrFail } from "@/lib/api/v2/rateLimit";
import { calcDayCached, calendarResponse, readLang } from "@/lib/api/v2/calendar";
import { formatDateISO } from "@/utils/dates";

// Сегодняшний день. «Сегодня» здесь гражданское: церковная дата и переход после
// вечерни считаются внутри и отдаются отдельным полем.
export const revalidate = 300;

export async function OPTIONS() {
    return preflight();
}

export async function GET(request: Request) {
    const limited = limitOrFail(request);
    if (limited) return limited;

    const today = formatDateISO(new Date());

    try {
        const result = await calcDayCached(today, readLang(new URL(request.url)));

        if (!result) {
            return fail("not_found", `На ${today} чтений не найдено`);
        }

        return respond(calendarResponse(today, result), { maxAge: 300 });
    } catch (e) {
        console.error(e);
        return fail("internal", "Не удалось рассчитать день");
    }
}

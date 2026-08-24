import { fail, preflight, respond } from "@/lib/api/v2/http";
import { authorize } from "@/lib/api/v2/access";
import { calcDayCached, calendarResponse, readLang } from "@/lib/api/v2/calendar";

// Что читается в конкретный день. Дата — гражданская (YYYY-MM-DD), всё остальное
// считается: подвижный круг с отступкой и преступкой, неподвижный календарь,
// памяти месяцеслова, зачала.
export const revalidate = 3600;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function OPTIONS() {
    return preflight();
}

export async function GET(request: Request, { params }: { params: { date: string } }) {
    const access = await authorize(request, "calendar");
    if (access.denied) return access.denied;

    if (!DATE.test(params.date) || isNaN(new Date(params.date).getTime())) {
        return fail("bad_request", "Дата указывается в виде ГГГГ-ММ-ДД");
    }

    try {
        const result = await calcDayCached(params.date, readLang(new URL(request.url)));

        if (!result) {
            return fail("not_found", `На ${params.date} чтений не найдено`);
        }

        return respond(calendarResponse(params.date, result), { access });
    } catch (e) {
        console.error(e);
        return fail("internal", "Не удалось рассчитать день");
    }
}

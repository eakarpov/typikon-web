import { authorize } from "@/lib/api/v2/access";
import { fail, preflight, respond } from "@/lib/api/v2/http";
import { memorialDay } from "@/lib/api/v2/serialize";
import { memorialSaturdays } from "@/lib/pomyannik/reckoning";
import { reportError } from "@/lib/reportError";

// ПОМИНАЛЬНЫЕ ДНИ ГОДА.
//
// Дни общие — они не зависят от того, чьи имена в помяннике, — и потому стоят
// отдельно от него и открыты по одному ключу, без сессии. Спрашивают их не «кого
// поминать», а «когда идти», и ответ на это одинаков для всех.
//
// Часть дней помечена `custom`: они не по Типикону, а по определению Собора,
// указу или местному обычаю, и Димитриевская суббота вдобавок считается в разных
// митрополиях неодинаково. Помету обязан донести и клиент: список без неё
// выглядит уставным целиком.
export const revalidate = 86400;

/** Дальше этих лет считать нечего: Пасхалия у нас верна для этого промежутка. */
const FIRST_YEAR = 1900;
const LAST_YEAR = 2099;

export async function OPTIONS() {
    return preflight();
}

export async function GET(request: Request) {
    const access = await authorize(request, "pomyannik");
    if (access.denied) return access.denied;

    const asked = Number(new URL(request.url).searchParams.get("year"));
    const year = Number.isFinite(asked) && asked ? Math.round(asked) : new Date().getFullYear();

    if (year < FIRST_YEAR || year > LAST_YEAR) {
        return fail("bad_request", `Год вне промежутка ${FIRST_YEAR}–${LAST_YEAR}`);
    }

    try {
        return respond(
            { year, days: memorialSaturdays(year).map(memorialDay) },
            { access, maxAge: revalidate },
        );
    } catch (e) {
        reportError(e, { where: "app/api/v2/pomyannik/calendar/route#GET", source: "api" });
        return fail("internal", "Не удалось посчитать поминальные дни");
    }
}

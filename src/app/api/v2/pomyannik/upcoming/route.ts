import { authorizeUser } from "@/lib/api/v2/user";
import { fail, respondPrivate } from "@/lib/api/v2/http";
import { upcomingEvent } from "@/lib/api/v2/serialize";
import { listPersons } from "@/lib/pomyannik/service";
import { todayIso, upcoming } from "@/lib/pomyannik/reckoning";
import { reportError } from "@/lib/reportError";

// БЛИЖАЙШЕЕ — то, ради чего помянник и открывают между службами: не список имён,
// а вопрос «кого поминать на этой неделе».
//
// `from` есть, хотя у ручки сайта его нет. Он нужен телефону: часовой пояс у
// того свой, и в час пополуночи по местному времени серверное «сегодня» бывает
// вчерашним. А кэшу он нужен затем, чтобы уметь сказать, на какой день посчитан:
// подвижные памяти и годовщины считаются от `from`, и окно, посчитанное неделю
// назад, начинается неделю назад.
export const dynamic = "force-dynamic";

const MAX_DAYS = 400;
const DEFAULT_DAYS = 60;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
    const access = await authorizeUser(request, "pomyannik");
    if (access.denied) return access.denied;

    const url = new URL(request.url);

    const asked = Number(url.searchParams.get("days"));
    const days = Number.isFinite(asked) && asked
        ? Math.min(MAX_DAYS, Math.max(1, Math.round(asked)))
        : DEFAULT_DAYS;

    const askedFrom = url.searchParams.get("from");
    if (askedFrom && !DATE.test(askedFrom)) {
        return fail("bad_request", "Дата начала пишется как ГГГГ-ММ-ДД");
    }
    const from = askedFrom || todayIso();

    try {
        const persons = await listPersons(access.userId);

        return respondPrivate(
            { from, days, events: upcoming(persons, from, days).map(upcomingEvent) },
            { access },
        );
    } catch (e) {
        reportError(e, { where: "app/api/v2/pomyannik/upcoming/route#GET", source: "api" });
        return fail("internal", "Не удалось посчитать ближайшие дни");
    }
}

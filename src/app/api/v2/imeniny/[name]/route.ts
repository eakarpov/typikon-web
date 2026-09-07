import { fail, preflight, respond } from "@/lib/api/v2/http";
import { authorize } from "@/lib/api/v2/access";
import { nameEntry, keyOf } from "@/lib/imeniny/store";
import { datesOf, nameDay } from "@/lib/imeniny/dates";
import { imeninyEntry } from "@/lib/api/v2/serialize";
import { reportError } from "@/lib/reportError";

// Кого поминают под этим именем и когда.
//
// Даты приводятся к гражданскому календарю ЗДЕСЬ, а не отдаются как есть.
// В святцах они записаны либо числом старого стиля («16.12»), либо смещением от
// Пасхи, и второе без даты Пасхи нужного года не разложить вовсе. Отдать сырьё
// значило бы заставить всякого клиента завести у себя пасхалию — и однажды
// разойтись с нами в ответе.
export const revalidate = 86400;

const YEAR_MIN = 1900;
const YEAR_MAX = 2099;

/** «03-15» — месяц и число рождения; год не спрашиваем, он к делу не идёт. */
const readBorn = (raw: string | null): { month: number; day: number } | null => {
    const match = /^(\d{1,2})-(\d{1,2})$/.exec((raw ?? "").trim());
    if (!match) return null;
    const month = Number(match[1]);
    const day = Number(match[2]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return { month, day };
};

export async function OPTIONS() {
    return preflight();
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ name: string }> },
) {
    const access = await authorize(request, "calendar");
    if (access.denied) return access.denied;

    const { name } = await params;

    let decoded: string;
    try {
        decoded = decodeURIComponent(name);
    } catch {
        return fail("bad_request", "Имя закодировано неверно");
    }

    const key = keyOf(decoded);
    if (!key) return fail("bad_request", "Имя должно быть не короче двух букв");

    const url = new URL(request.url);
    const rawYear = Number(url.searchParams.get("year"));
    // Тринадцать дней разницы календарей верны для 1900–2099; за этими границами
    // ответ был бы неверен, и лучше отказать, чем соврать.
    const year = Number.isFinite(rawYear) && rawYear >= YEAR_MIN && rawYear <= YEAR_MAX
        ? Math.floor(rawYear)
        : new Date().getFullYear();

    const born = readBorn(url.searchParams.get("born"));

    try {
        const entry = await nameEntry(key);
        if (!entry) return fail("not_found", "Такого имени в указателе нет");

        const memories = entry.saints.flatMap(saint => datesOf(saint.dates, year, saint));

        return respond(
            imeninyEntry(entry, year, memories, born ? nameDay(born, memories) : null),
            { access, maxAge: revalidate },
        );
    } catch (e) {
        reportError(e, { where: "app/api/v2/imeniny/[name]/route#GET", source: "api" });
        return fail("internal", "Не удалось получить сведения об имени");
    }
}

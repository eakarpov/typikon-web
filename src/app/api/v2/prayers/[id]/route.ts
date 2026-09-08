import { authorize } from "@/lib/api/v2/access";
import { fail, preflight, respond } from "@/lib/api/v2/http";
import { prayerDetail } from "@/lib/api/v2/serialize";
import { getPrayer } from "@/lib/prayers";
import { reportError } from "@/lib/reportError";

// МОЛИТВА ЦЕЛИКОМ.
//
// `owner` и `ownerId` говорят, при ком она напечатана. У молитвы акафиста по
// `ownerId` открывается сам акафист; у книжной вести пока некуда — страницы
// памяти у нас нет, а связь памяти со святым проставлена не везде.
//
// Соседи («здесь же напечатаны») едут тем же ответом: книга печатает молитвы
// вереницей, и читающий вторую обыкновенно хочет и первую.
export const revalidate = 3600;

export async function OPTIONS() {
    return preflight();
}

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
    const access = await authorize(request, "texts");
    if (access.denied) return access.denied;

    const { id: raw } = await ctx.params;

    let id: string;
    try {
        id = decodeURIComponent(raw);
    } catch {
        return fail("bad_request", "Адрес закодирован неверно");
    }

    try {
        const prayer = getPrayer(id);
        if (!prayer) return fail("not_found", "Такой молитвы в корпусе нет");

        return respond(prayerDetail(prayer, prayer.siblings), { access, maxAge: revalidate });
    } catch (e) {
        reportError(e, { where: "app/api/v2/prayers/[id]/route#GET", source: "api" });
        return fail("corpus_unavailable", "Корпус певческих текстов сейчас недоступен");
    }
}

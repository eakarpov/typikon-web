import { fail, preflight, respond } from "@/lib/api/v2/http";
import { authorize } from "@/lib/api/v2/access";
import { saintLife } from "@/lib/api/v2/serialize";
import { saintLifeOf } from "@/lib/saintLife";
import { reportError } from "@/lib/reportError";

// Житие святого: текст и ссылки со святцев dneslov.org.
//
// Рядом с досье, а не полем его: сведения сторонние, и когда dneslov.org молчит,
// досье обязано остаться целым — имя, дни памяти и тексты наши. Сначала
// смотрится наш снимок святцев (см. snapshotOfMemory), сеть — только догрузка.
//
// Текст жития — markdown в description; slug отдаётся ТЕХ святцев: их карточка
// на dneslov.org открывается по нему, а наш слуг им незнаком.
export const revalidate = 3600;

export async function OPTIONS() {
    return preflight();
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ address: string }> },
) {
    const access = await authorize(request, "calendar");
    if (access.denied) return access.denied;

    const { address: raw } = await params;

    let address: string;
    try {
        address = decodeURIComponent(raw);
    } catch {
        return fail("bad_request", "Адрес закодирован неверно");
    }
    if (!address.trim()) return fail("bad_request", "Не указан адрес святого");

    try {
        const result = await saintLifeOf(address);

        if (result.status === "no_saint") {
            return fail("not_found", "Такого святого в каталоге нет");
        }
        if (result.status === "no_link") {
            return fail("not_found", "Житие этой записи пока не связано с каталогом памятей.");
        }
        if (result.status === "no_details") {
            // Снимка в базе нет и святцы не ответили — «сейчас не знаем», а не
            // «жития нет». Такой исход не кэшируется (см. lib/saintLife) и
            // отдаётся no-store: при следующем запросе попробуем снова.
            const response = fail("internal", "Источник жития временно недоступен. Повторите позже.");
            return new Response(response.body, { status: 503, headers: response.headers });
        }

        const life = saintLife(result.details);
        if (!life) {
            return fail("not_found", "Жития этой записи в каталоге святцев нет");
        }

        return respond(life, { access });
    } catch (e) {
        reportError(e, { where: "app/api/v2/saints/dossier/[address]/life/route#GET", source: "api" });
        return fail("internal", "Не удалось получить житие святого");
    }
}

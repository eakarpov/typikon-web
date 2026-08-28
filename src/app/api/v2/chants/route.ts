import { fail, preflight, respondCollection } from "@/lib/api/v2/http";
import { authorize } from "@/lib/api/v2/access";
import { readPage } from "@/lib/api/v2/params";
import { chantSummary } from "@/lib/api/v2/serialize";
import { MIN_QUERY_LENGTH, searchChants } from "@/lib/chants";

// Поиск по певческим текстам книг: Октоих, Минеи, Триоди, Ирмологий.
//
// Отдельно от /api/v2/search, потому что это другой корпус и другое хранилище:
// там библиотека в Mongo, здесь разобранные по позициям службы песнопения в
// SQLite (см. @/lib/chants). Складывать их в одну выдачу нечестно — у них
// разные единицы: там текст целиком, здесь одна стихира на своём месте службы.
export const revalidate = 0;

const numeric = (url: URL, name: string): number | null => {
    const raw = url.searchParams.get(name);
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
};

export async function OPTIONS() {
    return preflight();
}

export async function GET(request: Request) {
    // Тот же раздел доступа, что у поиска по библиотеке: он идёт по всему
    // корпусу и стоит на порядок дороже прочих ручек, поэтому без ключа сюда
    // не пускают вовсе.
    const access = await authorize(request, "search");
    if (access.denied) return access.denied;

    const url = new URL(request.url);
    const { limit, offset } = readPage(url);
    const query = url.searchParams.get("q") ?? "";

    if (query.trim().length < MIN_QUERY_LENGTH) {
        return fail("bad_request", `Запрос должен быть не короче ${MIN_QUERY_LENGTH} символов`);
    }

    try {
        const found = searchChants(query, {
            source: url.searchParams.get("source"),
            book: url.searchParams.get("book"),
            month: numeric(url, "month"),
            day: numeric(url, "day"),
            tone: numeric(url, "tone"),
            sign: url.searchParams.get("sign"),
            memoryId: url.searchParams.get("memory"),
            service: url.searchParams.get("service"),
            unit: url.searchParams.get("unit"),
        }, limit, offset);

        // Корпус — отдельный файл, и на этом сервере его может не быть.
        // Говорим об этом прямо: пустая выдача читалась бы как «ничего не нашлось».
        if (!found) {
            return fail("internal", "Корпус певческих текстов на этом сервере недоступен");
        }

        return respondCollection(found.items.map(chantSummary),
            { total: found.total, limit, offset }, { maxAge: 300, access });
    } catch (e) {
        console.error(e);
        return fail("internal", "Поиск не удался");
    }
}

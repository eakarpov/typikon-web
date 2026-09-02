import { fail, preflight, respondCollection } from "@/lib/api/v2/http";
import { authorize } from "@/lib/api/v2/access";
import { readEnum, readPage } from "@/lib/api/v2/params";
import { incipitSummary } from "@/lib/api/v2/serialize";
import { LANGUAGES, listIncipits, normalizeIncipitQuery } from "@/lib/incipits";

// Указатель зачинов: песнопения книг по первым словам.
//
// Отличается от /api/v2/chants не корпусом, а единицей и способом поиска. Там
// единица — строка книги на своём месте службы, и ищется слово ГДЕ УГОДНО в
// тексте. Здесь единица — сам зачин, ключ отождествления, и ищется он ТОЛЬКО
// по началу: по зачину текст опознают и на зачин ссылаются.
export const revalidate = 0;

const SORTS = ["alpha", "uses"] as const;
const SOURCES = ["book", "canon", "akathist", "prayer"] as const;

export async function OPTIONS() {
    return preflight();
}

export async function GET(request: Request) {
    // Тот же раздел доступа, что у поиска: ручка идёт по всему корпусу, и
    // заводить ей отдельное значение в SCOPES незачем — ограничение то же.
    const access = await authorize(request, "search");
    if (access.denied) return access.denied;

    const url = new URL(request.url);
    const { limit, offset } = readPage(url);

    // Нормализуем ДО проверки на пустоту: строка из одних знаков препинания —
    // это тот же пустой запрос, и отвечать на неё перечислением всего указателя
    // было бы неожиданностью.
    const prefix = normalizeIncipitQuery(url.searchParams.get("q") ?? "");
    if (!prefix) {
        return fail(
            "bad_request",
            "Укажите начало песнопения в q. Указатель целиком отдаётся выгрузкой " +
            "корпуса (https://www.typikon.su/data), а не этой ручкой: перебор всех " +
            "182 650 зачинов на каждый запрос стоил бы секунду.",
        );
    }

    const language = readEnum(url, "language", LANGUAGES);
    if (url.searchParams.get("language") && !language) {
        return fail("bad_request", `Язык должен быть одним из: ${LANGUAGES.join(", ")}`);
    }

    try {
        const found = listIncipits(prefix, {
            language,
            unit: url.searchParams.get("unit"),
            source: readEnum(url, "source", SOURCES),
        }, readEnum(url, "sort", SORTS) === "uses" ? "uses" : "alpha", limit, offset);

        // Корпус — отдельный файл, и на этом сервере его может не быть.
        // Говорим прямо: пустая выдача читалась бы как «ничего не нашлось».
        if (!found) {
            return fail("internal", "Корпус певческих текстов на этом сервере недоступен");
        }

        return respondCollection(found.items.map(incipitSummary),
            { total: found.total, limit, offset }, { maxAge: 300, access });
    } catch (e) {
        console.error(e);
        return fail("internal", "Поиск по указателю не удался");
    }
}

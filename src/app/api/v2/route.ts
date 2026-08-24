import clientPromise from "@/lib/mongodb";
import { fail, preflight, respond } from "@/lib/api/v2/http";
import { authorize } from "@/lib/api/v2/access";
import { ANONYMOUS_ALLOWANCE, TIERS } from "@/lib/api/v2/tokens";
import { cached, CacheTag } from "@/lib/cache";

// Описание сервиса: с чего начинает знакомство любой клиент. Здесь же — условия
// использования, чтобы их нельзя было не заметить.
export const revalidate = 3600;

const counts = cached(async () => {
    const client = await clientPromise;
    const db = client.db("typikon");

    const [texts, books, days, pericopes, verses] = await Promise.all([
        db.collection("texts").countDocuments({ readiness: { $in: ["ready", "correcting", "texted"] } }),
        db.collection("books").countDocuments({ public: { $ne: false } }),
        db.collection("days").countDocuments(),
        db.collection("pericopes").countDocuments(),
        db.collection("verses").countDocuments(),
    ]);

    return { texts, books, days, pericopes, verses };
}, ["api-v2-counts"], [CacheTag.TEXTS, CacheTag.BOOKS, CacheTag.DAYS]);

export async function OPTIONS() {
    return preflight();
}

export async function GET(request: Request) {
    const access = await authorize(request, "texts");
    if (access.denied) return access.denied;

    try {
        return respond({
            name: "Уставные чтения",
            description:
                "Церковнославянские уставные чтения по Типикону: тексты, привязка к дням года, зачала.",
            version: "2",
            website: "https://typikon.su",
            license: {
                corpus: "CC-BY-4.0",
                url: "https://typikon.su/license",
                attribution: "Корпус «Уставные чтения» (typikon.su), CC BY 4.0",
                note: "Оригиналы памятников — общественное достояние. Сканы, переводы и данные dneslov.org принадлежат их владельцам.",
            },
            counts: await counts(),
            endpoints: {
                texts: "/api/v2/texts",
                text: "/api/v2/texts/{id|alias}",
                books: "/api/v2/books",
                book: "/api/v2/books/{id}",
                calendar: "/api/v2/calendar/{YYYY-MM-DD}",
                today: "/api/v2/calendar/today",
                search: "/api/v2/search?q=",
                pericopes: "/api/v2/pericopes",
                signs: "/api/v2/signs",
                documentation: "https://typikon.su/api",
            },
            // Первое, что хочет знать клиент после «что тут есть» — «сколько мне можно».
            access: {
                anonymous: `${ANONYMOUS_ALLOWANCE.limit} запросов в час с адреса, без поиска`,
                withKey: `${TIERS.free.limit} запросов в минуту и ${TIERS.free.perDay} в сутки, все разделы`,
                header: "Authorization: Bearer {ключ}",
                obtain: "https://typikon.su/profile",
                documentation: "https://typikon.su/api",
            },
            stability:
                "В версии 2 поля только добавляются. Несовместимые изменения выйдут отдельной версией.",
        }, { access });
    } catch (e) {
        console.error(e);
        return fail("internal", "Не удалось собрать описание сервиса");
    }
}

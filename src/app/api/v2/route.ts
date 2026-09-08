import clientPromise from "@/lib/mongodb";
import { fail, preflight, respond } from "@/lib/api/v2/http";
import { authorize } from "@/lib/api/v2/access";
import { ANONYMOUS_ALLOWANCE, TIERS } from "@/lib/api/v2/tokens";
import { cached, CacheTag } from "@/lib/cache";
import { ACCENTS_COLLECTION, ACCENTS_DB } from "@/lib/accents/store";
import {reportError} from "@/lib/reportError";
import { SITE_HOST, SITE_URL } from "@/utils/site";

// Описание сервиса: с чего начинает знакомство любой клиент. Здесь же — условия
// использования, чтобы их нельзя было не заметить.
export const revalidate = 3600;

const counts = cached(async () => {
    const client = await clientPromise;
    const db = client.db("typikon");

    const [texts, books, days, pericopes, verses, accents] = await Promise.all([
        db.collection("texts").countDocuments({ readiness: { $in: ["ready", "correcting", "texted"] } }),
        db.collection("books").countDocuments({ public: { $ne: false } }),
        db.collection("days").countDocuments(),
        db.collection("pericopes").countDocuments(),
        db.collection("verses").countDocuments(),
        // Словарь ударений живёт в соседней базе — рядом со словарём
        // церковнославянского, из которого он частью и собран.
        client.db(ACCENTS_DB).collection(ACCENTS_COLLECTION).countDocuments(),
    ]);

    return { texts, books, days, pericopes, verses, accents };
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
            website: SITE_URL,
            license: {
                corpus: "CC-BY-4.0",
                url: `${SITE_URL}/license`,
                attribution: `Корпус «Уставные чтения» (${SITE_HOST}), CC BY 4.0`,
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
                accents: "/api/v2/accents",
                accent: "/api/v2/accents/{слово}",
                // Песнопения тут не было с самого начала — недосмотр: ручка есть
                // и работает, а в перечне её не значилось.
                chants: "/api/v2/chants?q=",
                chant: "/api/v2/chants/{id}",
                incipits: "/api/v2/incipits?q=",
                incipit: "/api/v2/incipits/{язык}/{зачин}",
                pericopes: "/api/v2/pericopes",
                // Библии в перечне не значилось вовсе — тот же недосмотр, что был
                // с песнопениями: три ручки работают с самого переезда Библии на
                // свою модель, а знакомящийся с API клиент о них не узнавал.
                bibleBooks: "/api/v2/bible/books",
                bibleEditions: "/api/v2/bible/editions",
                bibleChapter: "/api/v2/bible/{книга}/{глава}",
                concordance: "/api/v2/concordance?ref=",
                signs: "/api/v2/signs",
                saint: "/api/v2/saints/dossier/{слуг|номер}",
                imeniny: "/api/v2/imeniny?q=",
                name: "/api/v2/imeniny/{имя}",
                chronology: "/api/v2/chronology?leto=",
                dictionary: "/api/v2/dictionary?q=",
                word: "/api/v2/dictionary/{id}",
                news: "/api/v2/news",
                // Помянник личный: ключ отмеряет частоту, а чей список открывать,
                // говорит сессия. Оттого он и назван здесь в перечне отдельно —
                // одним ключом эти три адреса не открываются.
                pomyannikVocabulary: "/api/v2/pomyannik/vocabulary",
                pomyannikCalendar: "/api/v2/pomyannik/calendar?year=",
                pomyannikPersons: "/api/v2/pomyannik/persons (нужен вход)",
                pomyannikPerson: "/api/v2/pomyannik/persons/{id} (нужен вход)",
                pomyannikUpcoming: "/api/v2/pomyannik/upcoming?days= (нужен вход)",
                pomyannikName: "/api/v2/pomyannik/name?q= (нужен вход)",
                pomyannikNote: "/api/v2/pomyannik/note/preview (нужен вход)",
                pomyannikZapiski: "/api/v2/pomyannik/zapiski (нужен вход)",
                pomyannikPrinyatye: "/api/v2/pomyannik/prinyatye (нужен вход и открытый приём)",
                documentation: `${SITE_URL}/api`,
            },
            // Первое, что хочет знать клиент после «что тут есть» — «сколько мне можно».
            access: {
                anonymous: `${ANONYMOUS_ALLOWANCE.limit} запросов в час с адреса, без поиска и помянника`,
                withKey: `${TIERS.free.limit} запросов в минуту и ${TIERS.free.perDay} в сутки, все разделы`,
                header: "Authorization: Bearer {ключ}",
                obtain: `${SITE_URL}/profile`,
                documentation: `${SITE_URL}/api`,
            },
            stability:
                "В версии 2 поля только добавляются. Несовместимые изменения выйдут отдельной версией.",
        }, { access });
    } catch (e) {
        reportError(e, { where: "app/api/v2/route#GET", source: "api" });
        return fail("internal", "Не удалось собрать описание сервиса");
    }
}

import { fail, preflight, respond } from "@/lib/api/v2/http";
import { authorize } from "@/lib/api/v2/access";
import { lookupWords, summarize } from "@/lib/accents/store";
import { cached, CacheTag } from "@/lib/cache";

// Словарь ударений. Без параметров — что это такое и как им пользоваться;
// с ?words= — поиск пачкой.
//
// Постраничного обхода здесь нет намеренно: 260 тысяч записей по двести за раз —
// это больше тысячи запросов ради того, что отдаётся одним файлом. Ссылка на
// выгрузку в ответе корня.
export const revalidate = 0;

// Больше двухсот слов за раз не берём — ровно как в постраничных ручках.
const MAX_WORDS = 200;

const summary = cached(summarize, ["api-v2-accents-summary"], [CacheTag.TEXTS]);

export async function OPTIONS() {
    return preflight();
}

export async function GET(request: Request) {
    const access = await authorize(request, "accents");
    if (access.denied) return access.denied;

    const url = new URL(request.url);
    const raw = url.searchParams.get("words");

    try {
        if (raw === null) {
            const counts = await summary();

            return respond({
                name: "Словарь ударений",
                description:
                    "Где в церковнославянском слове стоит ударение. Три источника: употребление "
                    + "в книжных чтениях (corpus, с частотами), в гимнографии — Октоих, Минеи, "
                    + "Триоди, Часослов (chants, с частотами) и порождённые парадигмы словаря "
                    + "церковнославянского языка (lexicon, с грамматикой).",
                // Без этой оговорки словарь начнут цитировать как источник нормы.
                caveat:
                    "Словарь описательный, а не нормативный: он говорит, как слово размечено "
                    + "в этих собраниях и сколько раз, а не как правильно. Где ошибся наборщик — "
                    + "ошибётся и словарь; где в книгах разнобой, там расходятся и варианты.",
                // Частоты книг и песнопений намеренно не сложены: жанр переворачивает
                // большинство, и сумма дала бы невнятную середину вместо двух ответов.
                genres:
                    "Частоты corpus и chants раздельные. «Спасе» в чтениях — аорист «спасе́» "
                    + "(50 раз), в песнопениях — звательный «спа́се» (2024). Берите тот источник, "
                    + "который отвечает вашему тексту.",
                words: counts.words,
                sources: {
                    corpus: counts.fromCorpus,
                    chants: counts.fromChants,
                    lexicon: counts.fromLexicon,
                    compared: counts.compared,
                    agree: counts.agree,
                    disagree: counts.disagree,
                },
                usage: {
                    word: "/api/v2/accents/{слово}",
                    batch: `/api/v2/accents?words=аще,земли,зело (до ${MAX_WORDS} слов)`,
                    note: "Слово можно слать как есть — с ударениями, звательцем, в любой графике.",
                },
                // Ссылку показываем, только когда файл действительно выложен:
                // обещать в API адрес, которого нет, хуже, чем промолчать.
                // Ставится в ACCENTS_DUMP_URL после настройки раздачи на сервере.
                ...(process.env.ACCENTS_DUMP_URL ? { download: process.env.ACCENTS_DUMP_URL } : {}),
                documentation: "https://typikon.su/api",
            }, { maxAge: 86400, access });
        }

        const words = raw.split(",").map((word) => word.trim()).filter(Boolean);

        if (!words.length) {
            return fail("bad_request", "Параметр words пуст: перечислите слова через запятую");
        }
        if (words.length > MAX_WORDS) {
            return fail("bad_request", `За раз не больше ${MAX_WORDS} слов, прислано ${words.length}`);
        }

        const items = await lookupWords(words);

        return respond({
            items,
            total: items.length,
            known: items.filter((item) => item.known).length,
        }, { maxAge: 86400, access });
    } catch (e) {
        console.error(e);
        return fail("internal", "Словарь ударений недоступен");
    }
}

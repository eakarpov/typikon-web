import { ERROR_CODES, LICENSE_ID, LICENSE_URL } from "@/lib/api/v2/http";
import { DEFAULT_LIMIT, MAX_LIMIT } from "@/lib/api/v2/params";
import { ANONYMOUS_ALLOWANCE, TIERS } from "@/lib/api/v2/tokens";
import { SITE_HOST, SITE_URL } from "@/utils/site";
import { BIBLE_SECTIONS } from "@/utils/bibleCanon";
import { LANGUAGES } from "@/lib/incipits";
import { WEEKDAYS } from "@/utils/chronology";

// Машинное описание API. Держим его рядом с кодом, а не отдельным файлом в репозитории:
// пределы постраничности и адрес лицензии берутся из тех же констант, что и в ручках,
// поэтому описание не разъедется с поведением.

const collection = (itemsRef: string) => ({
    type: "object",
    required: ["items", "total", "limit", "offset"],
    properties: {
        items: { type: "array", items: { $ref: itemsRef } },
        total: { type: "integer", description: "Сколько всего записей подходит под запрос" },
        limit: { type: "integer" },
        offset: { type: "integer" },
    },
});

/**
 * Конверт с отборами: то же, что `collection`, плюс чем можно сузить.
 *
 * Отборы едут с выдачей, а не отдельной ручкой: значения берутся из самого
 * корпуса, и приехавшие с ответом разойтись с ним не могут, а зашитые у клиента
 * — разошлись бы молча, как только в корпусе заведут новую роль или книгу.
 */
const collectionWithFacets = (itemsRef: string, facetsRef: string) => ({
    type: "object",
    required: ["items", "total", "limit", "offset", "facets"],
    properties: {
        items: { type: "array", items: { $ref: itemsRef } },
        total: { type: "integer" },
        limit: { type: "integer" },
        offset: { type: "integer" },
        facets: { $ref: facetsRef },
    },
});

const pageParams = [
    {
        name: "limit", in: "query", required: false,
        schema: { type: "integer", default: DEFAULT_LIMIT, maximum: MAX_LIMIT, minimum: 1 },
        description: `Сколько записей вернуть, не больше ${MAX_LIMIT}`,
    },
    {
        name: "offset", in: "query", required: false,
        schema: { type: "integer", default: 0, minimum: 0 },
        description: "Сколько записей пропустить",
    },
];

const errorResponse = (description: string) => ({
    description,
    content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
});

const ok = (ref: string, description = "Успешный ответ") => ({
    description,
    content: { "application/json": { schema: { $ref: ref } } },
});

const sends = (ref: string, description?: string) => ({
    required: true,
    description,
    content: { "application/json": { schema: { $ref: ref } } },
});

/** Отказ, общий всем личным ручкам: нет ключа либо нет входа. */
const needsSession = errorResponse(
    "Нет ключа (`unauthorized`) или нет входа (`session_required`). Различать их обязательно: "
    + "по первому клиенту следует признать ключ негодным, по второму — предложить войти.",
);
const personal = [{ apiKey: [], cookieAuth: [] }];

export const openapi = () => ({
    openapi: "3.1.0",
    info: {
        title: "Уставные чтения — API",
        version: "2.0.0",
        description:
            "Церковнославянские уставные чтения по Типикону: тексты, книги, привязка к дням " +
            "церковного года, зачала и знаки месяцеслова.\n\n" +
            "Нужен корпус целиком — не выбирайте его отсюда по записи: он выложен одним "
            + `набором файлов, ${SITE_URL}/data (JSON Lines, контрольные суммы, `
            + "лицензия на каждый слой).\n\n"
            + "Корпус доступен по лицензии CC BY 4.0 — пользуйтесь свободно, указывая источник. " +
            "Оригиналы памятников находятся в общественном достоянии. Сканы, переводы и данные " +
            "святцев принадлежат их владельцам.\n\n" +
            `Доступ отмерен. Без ключа — ${ANONYMOUS_ALLOWANCE.limit} запросов в час с адреса и без ` +
            "поиска: этого хватает попробовать. С ключом — " +
            `${TIERS.free.limit} запросов в минуту и ${TIERS.free.perDay} в сутки, включая поиск. ` +
            `Ключ заводится в профиле на ${SITE_HOST} и передаётся заголовком Authorization: Bearer. ` +
            "Остаток виден в заголовках X-RateLimit-Remaining и X-Quota-Remaining.",
        license: { name: LICENSE_ID, url: LICENSE_URL },
        contact: { url: `${SITE_URL}/contact` },
    },
    servers: [{ url: SITE_URL, description: "Основной сервер" }],
    // Ключ не обязателен: без него ручки тоже отвечают, только скупее и без поиска.
    // Поэтому security на уровне документа, а не в каждой операции.
    security: [{ apiKey: [] }, {}],
    tags: [
        { name: "Календарь", description: "Что читается в конкретный день" },
        { name: "Тексты", description: "Корпус текстов и книги" },
        { name: "Справочники", description: "Зачала, знаки, месяцы, седмицы, святые" },
        { name: "Песнопения", description: "Стихиры, тропари и каноны книг по местам службы" },
        { name: "Новости", description: "Что нового в корпусе и на сайте" },
        { name: "Ударения", description: "Где в церковнославянском слове стоит ударение" },
        { name: "Библия", description: "Книги Библии по главам; издания читаются рядом, стих против стиха" },
        {
            name: "Приложение",
            description:
                "Мобильное приложение: какая версия выложена и где её взять. "
                + "Единственная ручка v2, которую не запирает ключ.",
        },
        {
            name: "Помянник",
            description:
                "Личный перечень имён и дни, которые они приносят. Нужен и ключ, и вход: "
                + "ключ отмеряет частоту, а чей список открывать — говорит сессия.",
        },
    ],
    paths: {
        "/api/v2": {
            get: {
                tags: ["Справочники"],
                summary: "Описание сервиса",
                description: "Счётчики корпуса, условия использования и список ручек.",
                responses: { "200": ok("#/components/schemas/Service") },
            },
        },
        "/api/v2/calendar/{date}": {
            get: {
                tags: ["Календарь"],
                summary: "Чтения на дату",
                description:
                    "Подвижный круг с отступкой и преступкой, неподвижный календарь, памяти " +
                    "месяцеслова и зачала — сведённые в один ответ.",
                parameters: [
                    { name: "date", in: "path", required: true, schema: { type: "string", format: "date" }, example: "2026-04-12" },
                    { name: "lang", in: "query", required: false, schema: { type: "string", enum: ["cs", "ro"], default: "cs" }, description: "Язык библейских зачал" },
                ],
                responses: {
                    "200": ok("#/components/schemas/CalendarDay"),
                    "400": errorResponse("Дата указана неверно"),
                    "404": errorResponse("На эту дату чтений не найдено"),
                },
            },
        },
        "/api/v2/calendar/today": {
            get: {
                tags: ["Календарь"],
                summary: "Чтения на сегодня",
                responses: { "200": ok("#/components/schemas/CalendarDay") },
            },
        },
        "/api/v2/texts": {
            get: {
                tags: ["Тексты"],
                summary: "Список текстов",
                description: "Без тела текста — за ним в карточку.",
                parameters: [
                    ...pageParams,
                    { name: "book", in: "query", schema: { type: "string" }, description: "Идентификатор книги" },
                    { name: "readiness", in: "query", schema: { type: "string", enum: ["ready", "correcting", "texted", "presence", "absence"] } },
                    { name: "saint", in: "query", schema: { type: "string" }, description: "Идентификатор святого в святцах dneslov.org" },
                    { name: "updatedSince", in: "query", schema: { type: "string", format: "date-time" }, description: "Только изменённые с этого момента" },
                    {
                        name: "ids", in: "query", schema: { type: "string" },
                        description:
                            "Поимённо, через запятую, не больше 200. Для случая, когда список "
                            + "идентификаторов уже на руках — избранное, закладки: иначе "
                            + "пришлось бы слать запрос на текст. Негодный идентификатор в "
                            + "списке — отказ, а не пропуск: неполная выдача выглядит полной",
                    },
                    {
                        name: "sort", in: "query", schema: { type: "string", enum: ["updated"] },
                        description:
                            "Обычный порядок — по месту в книге. `updated` — по времени "
                            + "правки, новые первыми: «что пополнилось» обычным порядком не "
                            + "спросить, updatedSince отберёт нужные, но первыми отдаст те, "
                            + "что раньше стоят в книге",
                    },
                ],
                responses: { "200": ok("#/components/schemas/TextList"), "400": errorResponse("Неверный параметр") },
            },
        },
        "/api/v2/texts/{id}": {
            get: {
                tags: ["Тексты"],
                summary: "Текст целиком",
                description: "Принимает и постоянный адрес (alias), и идентификатор.",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" }, example: "prolog-08-11-eupl" }],
                responses: { "200": ok("#/components/schemas/TextDetail"), "404": errorResponse("Текст не найден") },
            },
        },
        "/api/v2/books": {
            get: { tags: ["Тексты"], summary: "Список книг", parameters: pageParams, responses: { "200": ok("#/components/schemas/BookList") } },
        },
        "/api/v2/books/{id}": {
            get: {
                tags: ["Тексты"],
                summary: "Книга и её тексты",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }, ...pageParams],
                responses: { "200": ok("#/components/schemas/BookDetail"), "404": errorResponse("Книга не найдена") },
            },
        },
        "/api/v2/accents": {
            get: {
                tags: ["Ударения"],
                summary: "Словарь ударений: сводка или поиск пачкой",
                description:
                    "Без параметров — что это за словарь, из чего собран и где скачать целиком.\n\n" +
                    "С параметром words — до 200 слов за раз; ответ идёт в том же порядке, что и запрос.\n\n" +
                    "Слово можно слать как есть: с ударениями, звательцем, в церковнославянской " +
                    "графике — ключ снимается той же нормализацией, которой собран словарь, поэтому " +
                    "«а҆́ще», «аще» и «А́ЩЕ» — один и тот же запрос.\n\n" +
                    "Постраничного обхода нет намеренно: 260 тысяч записей по двести за раз — больше " +
                    "тысячи запросов ради того, что отдаётся одним файлом.",
                parameters: [
                    {
                        name: "words", in: "query", required: false,
                        schema: { type: "string" },
                        example: "аще,земли,зело",
                        description: "Слова через запятую, не больше 200",
                    },
                ],
                responses: {
                    "200": ok("#/components/schemas/AccentBatch"),
                    "400": errorResponse("Пустой список или больше 200 слов"),
                },
            },
        },
        "/api/v2/accents/{word}": {
            get: {
                tags: ["Ударения"],
                summary: "Ударение одного слова",
                description:
                    "Слова, которого нет в словаре, — это 200 с known: false, а не 404. " +
                    "Имён собственных, редких форм и опечаток исходника в словаре нет и не будет; " +
                    "для потребителя это рабочий ответ, а не сбой.",
                parameters: [
                    { name: "word", in: "path", required: true, schema: { type: "string" }, example: "земли" },
                ],
                responses: {
                    "200": ok("#/components/schemas/Accent"),
                    "400": errorResponse("Не указано слово"),
                },
            },
        },
        "/api/v2/search": {
            get: {
                tags: ["Тексты"],
                summary: "Поиск по названию и содержимому",
                description:
                    "Ударения и церковнославянское написание набирать не нужно: «стражи» находит " +
                    "«стра́жи», «иоанна» — «і҆ѡа́нна». Фрагмент возвращается в исходном написании.",
                parameters: [
                    { name: "q", in: "query", required: true, schema: { type: "string", minLength: 3 }, example: "аввакум" },
                    ...pageParams,
                ],
                responses: { "200": ok("#/components/schemas/SearchList"), "400": errorResponse("Запрос слишком короткий") },
            },
        },
        "/api/v2/chants": {
            get: {
                tags: ["Песнопения"],
                summary: "Поиск по певческим текстам книг",
                description:
                    "Стихиры, седальны, тропари, ирмосы и прочие песнопения Октоиха, Миней, " +
                    "Триодей и Ирмология — каждое на своём месте службы, с памятью, знаком и " +
                    "гласом. Это другой корпус, нежели /api/v2/search: там книги целиком, " +
                    "здесь службы, разобранные по позициям.\n\n" +
                    "Ударения и церковнославянское написание набирать не нужно: «услыши» " +
                    "находит «услы́ши», «ᲂу҆слы́ши» — тоже. Фрагмент приходит кусками, и " +
                    "найденное в нём помечено полем hit, а не разметкой внутри строки.",
                parameters: [
                    { name: "q", in: "query", required: true, schema: { type: "string", minLength: 3 }, example: "воззвах" },
                    { name: "book", in: "query", required: false, schema: { type: "string", enum: ["menaion", "octoechos", "triod-postnaya", "triod-tsvetnaya", "obshaya-mineya"] } },
                    { name: "month", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 12 }, description: "Месяц церковного месяцеслова" },
                    { name: "day", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 31 } },
                    { name: "tone", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 8 }, description: "Глас" },
                    { name: "sign", in: "query", required: false, schema: { type: "string" }, example: "polieley", description: "Знак службы по Типикону" },
                    { name: "memory", in: "query", required: false, schema: { type: "string" }, description: "Память, которой поётся песнопение" },
                    { name: "service", in: "query", required: false, schema: { type: "string", enum: ["vespers", "matins", "liturgy", "hours", "compline", "midnight"] } },
                    { name: "unit", in: "query", required: false, schema: { type: "string" }, example: "stichera", description: "Род песнопения" },
                    {
                        name: "language", in: "query", required: false,
                        schema: { type: "string", enum: [...LANGUAGES] },
                        description: "Язык песнопения: cu_gr — церковнославянский, ro — румынский, grc — греческий",
                    },
                    ...pageParams,
                ],
                responses: {
                    "200": ok("#/components/schemas/ChantList"),
                    "400": errorResponse("Запрос слишком короткий"),
                    "503": errorResponse("Корпус на этом сервере не выложен; code — corpus_unavailable"),
                },
            },
        },
        "/api/v2/chants/{id}": {
            get: {
                tags: ["Песнопения"],
                summary: "Песнопение целиком",
                description:
                    "То, что обещало поле sampleId указателя зачинов. Идентификатор — номер "
                    + "строки корпуса; берётся из sampleId или из witnesses[].id.\n\n"
                    + "Текст бывает взят по ссылке: книги печатают ирмос зачином, а полный текст "
                    + "лежит в Ирмологии. Такой ответ помечен borrowed, и помету надо донести до "
                    + "читателя — иначе подставленный текст выдаётся за напечатанный здесь.",
                parameters: [{
                    name: "id", in: "path", required: true,
                    schema: { type: "integer" }, example: 40005,
                }],
                responses: {
                    "200": ok("#/components/schemas/ChantDetail"),
                    "400": errorResponse("Идентификатор строки — целое число"),
                    "404": errorResponse("Такого песнопения в корпусе нет"),
                },
            },
        },
        "/api/v2/canons": {
            get: {
                tags: ["Песнопения"],
                summary: "Каноны книг",
                description:
                    "Каноны Октоиха, Миней, Триодей и Минеи общей. Пустой запрос — не ошибка, а "
                    + "начало просмотра: перечень канонов сам по себе и есть содержимое раздела, "
                    + "а поиск его сужает.\n\nИщется по тому, кому канон и чьё он творение. "
                    + "Имена — как их пишет книга, в родительном падеже: «Никола́я», а не "
                    + "«Николаю»; ударения набирать не нужно, и части слова довольно.",
                parameters: [
                    { name: "q", in: "query", required: false, schema: { type: "string" }, example: "Николая Дамаскина" },
                    { name: "book", in: "query", required: false, schema: { type: "string" } },
                    { name: "tone", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 8 } },
                    { name: "service", in: "query", required: false, schema: { type: "string" } },
                    { name: "role", in: "query", required: false, schema: { type: "string" }, description: "Роль канона: воскресный, крестовоскресный, богородичен" },
                    ...pageParams,
                ],
                responses: {
                    "200": ok("#/components/schemas/CanonList"),
                    "503": errorResponse("Корпус певческих текстов на этом сервере не выложен"),
                },
            },
        },
        "/api/v2/canons/{id}": {
            get: {
                tags: ["Песнопения"],
                summary: "Канон целиком",
                description:
                    "Песни подряд, как в книге: ирмос, затем тропари.\n\n**Нумерация песней не "
                    + "сплошная, и это не изъян разбора.** Второй песни нет ни у кого, кроме "
                    + "Великого канона, а трипеснцы Триоди несут три и меньше. Номер отдаётся "
                    + "тот, что стоит у песни в книге: перенумеровав их подряд, вы «почините» "
                    + "пропуск, которого нет.\n\nУ строки бывает `borrowed`: книга печатает "
                    + "ирмос зачином, а полный текст лежит в Ирмологии. Помету надо донести до "
                    + "читателя — иначе подставленный текст выдаётся за напечатанный здесь.\n\n"
                    + "А бывает `reference` при пустом тексте: ссылка есть, разрешить её не "
                    + "удалось. Печатать опознаватель уставным кеглем нельзя — скажите словами, "
                    + "что текста в корпусе нет.",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" }, example: "mineya-06-15-6-svc2-canon2" }],
                responses: {
                    "200": ok("#/components/schemas/CanonDetail"),
                    "404": errorResponse("Такого канона в корпусе нет"),
                    "503": errorResponse("Корпус недоступен"),
                },
            },
        },
        "/api/v2/akathists": {
            get: {
                tags: ["Песнопения"],
                summary: "Акафисты корпуса",
                description:
                    "**Уставом положен один акафист — Великий.** Остальные собраны ради корпуса и "
                    + "поиска и в сборку служб не идут; это говорит поле `status`, и донести его "
                    + "обязан всякий, кто показывает перечень: раздел похож на устав и им не "
                    + "является.",
                parameters: [
                    { name: "q", in: "query", required: false, schema: { type: "string" }, example: "Николаю" },
                    { name: "subject", in: "query", required: false, schema: { type: "string" }, description: "Кому: gospod, bogorodica, ikona, prazdnik, svyatoy, inoe" },
                    { name: "status", in: "query", required: false, schema: { type: "string", enum: ["ustavny", "odobrenny", "chastny"] } },
                    ...pageParams,
                ],
                responses: {
                    "200": ok("#/components/schemas/AkathistList"),
                    "503": errorResponse("Корпус певческих текстов на этом сервере не выложен"),
                },
            },
        },
        "/api/v2/akathists/{id}": {
            get: {
                tags: ["Песнопения"],
                summary: "Акафист целиком",
                description:
                    "Строфы в порядке `index` — это порядок чтения. Сортировать их по паре «род и "
                    + "номер» неверно: проимий и первый икос акростиха разойдутся по разным "
                    + "концам.\n\nПодписывает строфу пара «род + номер» — «икос 6», «кондак 12»: "
                    + "именно парой акафист и цитируют. У проимиев счёт свой, и различает их "
                    + "`kind`, а не номер.\n\nМолитвы при акафисте едут тем же ответом: молитва "
                    + "не строфа, но печатается здесь же.",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" }, example: "narod-a-adrian-poshehonsky" }],
                responses: {
                    "200": ok("#/components/schemas/AkathistDetail"),
                    "404": errorResponse("Такого акафиста в корпусе нет"),
                    "503": errorResponse("Корпус недоступен"),
                },
            },
        },
        "/api/v2/prayers": {
            get: {
                tags: ["Песнопения"],
                summary: "Молитвы книг и молитвы при акафистах",
                description:
                    "Молитву называет не подпись, а тот, при ком она стоит: подписаны почти все "
                    + "просто «Моли́тва». Оттого искать можно и по имени владельца, и по зачину — "
                    + "зачин и есть то единственное, чем две молитвы одного акафиста различаются.",
                parameters: [
                    { name: "q", in: "query", required: false, schema: { type: "string" }, example: "о всепетая" },
                    { name: "kind", in: "query", required: false, schema: { type: "string", enum: ["memory", "akathist", "canon"] }, description: "При ком напечатана" },
                    ...pageParams,
                ],
                responses: {
                    "200": ok("#/components/schemas/PrayerList"),
                    "503": errorResponse("Корпус певческих текстов на этом сервере не выложен"),
                },
            },
        },
        "/api/v2/prayers/{id}": {
            get: {
                tags: ["Песнопения"],
                summary: "Молитва целиком",
                description:
                    "Вместе с соседями — тем, что напечатано здесь же: книга печатает молитвы "
                    + "вереницей, и читающий вторую обыкновенно хочет и первую.",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
                responses: {
                    "200": ok("#/components/schemas/PrayerDetail"),
                    "404": errorResponse("Такой молитвы в корпусе нет"),
                    "503": errorResponse("Корпус недоступен"),
                },
            },
        },
        "/api/v2/incipits": {
            get: {
                tags: ["Песнопения"],
                summary: "Указатель зачинов: поиск по первым словам",
                description:
                    "Зачин (инципит) — первые шесть слов песнопения без ударений: то, чем " +
                    "текст опознают и на что ссылаются. Ищется ТОЛЬКО по началу, и этим " +
                    "ручка отличается от /api/v2/chants, где слово находится где угодно " +
                    "в тексте.\n\n" +
                    "Ударения и церковнославянское написание набирать не нужно. Учтите, " +
                    "что ключ сводит «й» к «и»: «Радуйся» ищется и находится как " +
                    "«радуися».\n\n" +
                    "Указатель целиком эта ручка не отдаёт — для этого есть выгрузка " +
                    `корпуса на ${SITE_URL}/data.`,
                parameters: [
                    { name: "q", in: "query", required: true, schema: { type: "string" }, example: "воду прошед", description: "Начало песнопения" },
                    { name: "language", in: "query", required: false, schema: { type: "string", enum: ["cu_gr", "ro", "grc", "en", "et", "ar"] }, description: "Язык текста. Зачины разных языков не пересекаются: между языками инципит не отождествляет ничего" },
                    { name: "unit", in: "query", required: false, schema: { type: "string" }, example: "irmos", description: "Род песнопения" },
                    { name: "source", in: "query", required: false, schema: { type: "string", enum: ["book", "canon", "akathist", "prayer"] }, description: "Чем строка является в корпусе" },
                    { name: "sort", in: "query", required: false, schema: { type: "string", enum: ["alpha", "uses"], default: "alpha" }, description: "По алфавиту или сперва часто встречающиеся" },
                    ...pageParams,
                ],
                responses: {
                    "200": ok("#/components/schemas/IncipitList"),
                    "400": errorResponse("Не указано начало песнопения или неизвестный язык"),
                    "503": errorResponse("Корпус на этом сервере не выложен; code — corpus_unavailable"),
                },
            },
        },
        "/api/v2/incipits/{language}/{incipit}": {
            get: {
                tags: ["Песнопения"],
                summary: "Зачин по постоянному адресу",
                description:
                    "Все вхождения зачина в корпусе и все соответствия ему на других " +
                    "языках. Ключ в адресе — сам зачин, как он лежит в корпусе; своего " +
                    "идентификатора у зачина нет, ключ и есть идентификатор.\n\n" +
                    "Соответствия разделены по тому, на чём держатся, и смешивать их " +
                    "нельзя. В `declared` — заявленное изданием: у AGES греческий и " +
                    "английский слои стоят на одном ключе издателя, и что одна строка " +
                    "есть перевод другой, утверждает книга. В `supposed` — догадка по " +
                    "совпавшему месту службы, и она БЫВАЕТ ЛОЖНОЙ: на одно место разные " +
                    "книги ставят разное. Поле `evidence` говорит, на чём стоит связь.\n\n" +
                    "Пустые `declared` и `supposed` значат «связь не построена», а не " +
                    "«соответствия нет»: славянский связан с другими языками лишь на 9 %.",
                parameters: [
                    { name: "language", in: "path", required: true, schema: { type: "string", enum: ["cu_gr", "ro", "grc", "en", "et", "ar"] } },
                    { name: "incipit", in: "path", required: true, schema: { type: "string" }, example: "воду прошед яко сушу и египетскаго" },
                ],
                responses: {
                    "200": ok("#/components/schemas/IncipitDetail"),
                    "400": errorResponse("Неизвестный язык или неверно закодированный ключ"),
                    "404": errorResponse("Зачин не найден"),
                },
            },
        },
        "/api/v2/days/{alias}": {
            get: {
                tags: ["Календарь"],
                summary: "День по постоянному адресу",
                parameters: [
                    { name: "alias", in: "path", required: true, schema: { type: "string" }, example: "pascha" },
                    {
                        name: "expand", in: "query", schema: { type: "string", enum: ["content"] },
                        description:
                            "`content` — вложить тела текстов прямо в чтения. По умолчанию их "
                            + "нет, и странице дня они не нужны: она ведёт в текст ссылкой. Но "
                            + "клиенту, который день читает, без них достаётся запрос на "
                            + "каждый текст, а их в ином дне полсотни",
                    },
                ],
                responses: { "200": ok("#/components/schemas/Day"), "404": errorResponse("День не найден") },
            },
        },
        "/api/v2/months": {
            get: { tags: ["Справочники"], summary: "Месяцы неподвижного круга", responses: { "200": ok("#/components/schemas/MonthList") } },
        },
        "/api/v2/months/{alias}": {
            get: {
                tags: ["Справочники"],
                summary: "Месяц и его дни",
                parameters: [{ name: "alias", in: "path", required: true, schema: { type: "string" }, example: "january" }],
                responses: { "200": ok("#/components/schemas/MonthDetail"), "404": errorResponse("Месяц не найден") },
            },
        },
        "/api/v2/weeks": {
            get: {
                tags: ["Справочники"],
                summary: "Седмицы года",
                description:
                    "Без `cycle` — обе Триоди, постная и цветная (двадцать седмиц). "
                    + "`out-triodion` — рядовые седмицы года, их пятьдесят три.\n\n"
                    + "Незнакомый круг — отказ, а не подмена: прежде спросивший `out-triodion` "
                    + "получал союз двух других кругов, и ответ выглядел правдоподобно ровно "
                    + "настолько, чтобы ошибку не заметить.",
                parameters: [{
                    name: "cycle", in: "query",
                    schema: { type: "string", enum: ["triodion", "penticostarion", "out-triodion"] },
                }],
                responses: {
                    "200": ok("#/components/schemas/WeekList"),
                    "400": errorResponse("Незнакомый круг"),
                },
            },
        },
        "/api/v2/weeks/{alias}": {
            get: {
                tags: ["Справочники"],
                summary: "Седмица и её дни",
                parameters: [{ name: "alias", in: "path", required: true, schema: { type: "string" }, example: "post-1" }],
                responses: { "200": ok("#/components/schemas/WeekDetail"), "404": errorResponse("Седмица не найдена") },
            },
        },
        "/api/v2/pericopes": {
            get: {
                tags: ["Справочники"],
                summary: "Зачала",
                parameters: [
                    { name: "source", in: "query", schema: { type: "string", enum: ["gospel", "apostle", "paremia"] } },
                    { name: "book", in: "query", schema: { type: "string" }, description: "Слаг библейской книги" },
                    ...pageParams,
                ],
                responses: { "200": ok("#/components/schemas/PericopeList") },
            },
        },
        "/api/v2/bible/books": {
            get: {
                tags: ["Библия"],
                summary: "Оглавление Библии",
                description:
                    "Книги канона и, признаком inCanon: false, книги приложения — те, что " +
                    "издания печатают, а славянский канон не держит. Отдаётся целиком, без " +
                    "постраничности: список закрыт.\n\nПорядок значим и является частью " +
                    "ответа — канон идёт в порядке Елизаветинской Библии, а не по алфавиту; " +
                    "пересортировав, восстановить его будет неоткуда.",
                responses: { "200": ok("#/components/schemas/BibleBookList") },
            },
        },
        "/api/v2/bible/editions": {
            get: {
                tags: ["Библия"],
                summary: "Издания Библии",
                description: "Что можно подставить в параметр editions у главы.",
                responses: { "200": ok("#/components/schemas/BibleEditionList") },
            },
        },
        "/api/v2/bible/{book}/{chapter}": {
            get: {
                tags: ["Библия"],
                summary: "Глава Библии, при желании — в нескольких изданиях сразу",
                description:
                    "Стихи сводятся по каноническому месту, а не по номеру строки: у изданий " +
                    "своя разбивка, и на месте стиха, которого в издании нет, стоит null, а не " +
                    "сдвинутый соседний. Поля chapter/verse — каноническая нумерация (ею названы " +
                    "зачала), editionChapter/editionVerse — как стих напечатан в самом издании.",
                parameters: [
                    { name: "book", in: "path", required: true, schema: { type: "string" }, example: "daniila", description: "Идентификатор книги канона" },
                    { name: "chapter", in: "path", required: true, schema: { type: "integer", minimum: 1 }, example: 3 },
                    {
                        name: "editions", in: "query", required: false,
                        schema: { type: "string" }, example: "cs-eliz,ro-1688",
                        description: "Коды изданий через запятую; порядок задаёт порядок колонок. По умолчанию — все публичные",
                    },
                ],
                responses: {
                    "200": ok("#/components/schemas/BibleChapter"),
                    "400": errorResponse("Неверный номер главы"),
                    "404": errorResponse("Книги, издания или главы нет"),
                },
            },
        },
        "/api/v2/concordance": {
            get: {
                tags: ["Библия"],
                summary: "Согласование нумераций: где стих стоит в каждом издании",
                description:
                    "Пара «глава:стих» ничего не значит, пока не сказано, чьим счётом она " +
                    "названа: у румынской Псалтири в девятом псалме на стих меньше, чем у " +
                    "славянской, а греческие Притчи идут в 29 главах против славянского 31. " +
                    "Ручка отвечает, где один и тот же стих стоит в каждом издании.\n\n" +
                    "Это соответствие МЕСТА, а не текста: пары может не оказаться вовсе, а " +
                    "разорванный надвое стих даёт в издании два места.\n\n" +
                    "Без ref — описание ручки и список изданий. Всю таблицу (192 106 строк) " +
                    `берите файлом из выгрузки: ${SITE_URL}/data`,
                parameters: [
                    {
                        name: "ref", in: "query", required: false,
                        schema: { type: "string" }, example: "psaltir.9.13",
                        description: "Адрес стиха как книга.глава.стих. Канонический, если не указан from",
                    },
                    {
                        name: "from", in: "query", required: false,
                        schema: { type: "string" }, example: "grc-lxx-pat",
                        description: "Код издания, в чьём собственном счёте дан ref",
                    },
                ],
                responses: {
                    "200": ok("#/components/schemas/Concordance"),
                    "400": errorResponse("Адрес стиха задан неверно"),
                    "404": errorResponse("Такого стиха нет"),
                },
            },
        },
        "/api/v2/signs": {
            get: {
                tags: ["Справочники"],
                summary: "Знаки Типикона по месяцеслову",
                description: "Месяц и число — по старому стилю.",
                parameters: [
                    { name: "month", in: "query", schema: { type: "integer", minimum: 1, maximum: 12 } },
                    { name: "date", in: "query", schema: { type: "integer", minimum: 1, maximum: 31 } },
                    ...pageParams,
                ],
                responses: { "200": ok("#/components/schemas/SignList"), "400": errorResponse("Неверный месяц или число") },
            },
        },
        "/api/v2/app/version": {
            get: {
                tags: ["Приложение"],
                summary: "Выложенная версия приложения",
                description:
                    "Какая версия лежит на сайте и откуда её взять. Приложение спрашивает "
                    + "фоновой задачей и показывает уведомление, если выложенное новее "
                    + "установленного.\n\n**Номер сравнивается тройкой, а не по частям.** "
                    + "`minor` версии 1.9 больше нуля у 2.0, и сравнение по отдельным числам "
                    + "объявило бы старшей 1.9.\n\n**Ключ здесь не обязателен, и это "
                    + "нарочно.** Отсюда установленная копия узнаёт о новой версии — в том "
                    + "числе о той, которая чинит поломку с ключом; заперев ручку отказом "
                    + "«ключ отозван», мы отняли бы у неё способность узнать о собственном "
                    + "исправлении. Годный ключ при этом в чести: он даёт порцию по "
                    + "устройству вместо общей анонимной по адресу.",
                responses: { "200": ok("#/components/schemas/AppVersion") },
            },
        },
        "/api/v2/pomyannik/devices": {
            post: {
                tags: ["Помянник"],
                summary: "Запомнить устройство для точных напоминаний",
                description:
                    "Приложение умеет напоминать о поминальном дне само, но показывает "
                    + "напоминание тогда, когда система даст фоновой задаче окно — то есть "
                    + "когда придётся, а иной день и никогда. Толчок с сервера приходит в "
                    + "минуту.\n\n**Имён в толчке нет.** Сервер смотрит, ЕСТЬ ли сегодня "
                    + "поминальный день, и будит приложение пустым сообщением; что сказать, "
                    + "приложение решает по своему зеркалу. Гнать имена родни через чужие "
                    + "серверы ради удобства нельзя.\n\nЧасовой пояс обязателен: восемь утра "
                    + "в Петропавловске и восемь утра в Калининграде — одиннадцать часов "
                    + "разницы.",
                responses: {
                    "200": ok("#/components/schemas/Ok"),
                    "400": errorResponse("Нет ключа доставки или пояс неизвестен"),
                    "401": errorResponse("Ключ или вход; code — unauthorized либо session_required"),
                },
            },
            delete: {
                tags: ["Помянник"],
                summary: "Забыть устройство",
                description:
                    "Выключили точные напоминания или вышли из учётной записи. Ключа не "
                    + "нашлось — тоже успех: выключить дважды не ошибка.",
                parameters: [{
                    name: "token", in: "query", required: true, schema: { type: "string" },
                }],
                responses: {
                    "200": ok("#/components/schemas/Ok"),
                    "400": errorResponse("Нет ключа доставки"),
                    "401": errorResponse("Ключ или вход; code — unauthorized либо session_required"),
                },
            },
        },
        "/api/v2/texts/{id}/day": {
            get: {
                tags: ["Календарь"],
                summary: "День, в который читается этот текст",
                description:
                    "Обратный ход к /api/v2/days/{alias}: там спрашивают «что читается "
                    + "сегодня», здесь — «когда читается вот это». Связь книги с днём в самом "
                    + "тексте не записана, и другого пути из текста в службу дня нет.\n\n"
                    + "`404` — у текста нет дня, и это обычное дело: не всё, что лежит в "
                    + "корпусе, положено на число. Пустым днём это не подменяется — пустой "
                    + "читался бы как «в этот день ничего не читается».",
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "string" } },
                    {
                        name: "expand", in: "query", schema: { type: "string", enum: ["content"] },
                        description:
                            "`content` — вложить тела текстов прямо в чтения. По умолчанию их "
                            + "нет, и странице дня они не нужны: она ведёт в текст ссылкой. Но "
                            + "клиенту, который день читает, без них достаётся запрос на "
                            + "каждый текст, а их в ином дне полсотни",
                    },
                ],
                responses: {
                    "200": ok("#/components/schemas/Day"),
                    "404": errorResponse("У этого текста нет дня"),
                },
            },
        },
        "/api/v2/places/{id}": {
            get: {
                tags: ["Справочники"],
                summary: "Место",
                description:
                    "То, что помечено в тексте географическим именем. Спрашивается и по "
                    + "идентификатору, и по псевдониму.\n\nШироты и долготы может не быть, "
                    + "и это не изъян записи: у пустыни Иорданской точки нет, у Иерусалима есть.",
                parameters: [{
                    name: "id", in: "path", required: true, schema: { type: "string" },
                }],
                responses: {
                    "200": ok("#/components/schemas/Place"),
                    "404": errorResponse("Такого места нет"),
                },
            },
        },
        "/api/v2/news": {
            get: {
                tags: ["Новости"],
                summary: "Новости сайта",
                description: "Что пополнилось в корпусе и что изменилось. Тело записи — markdown.",
                parameters: pageParams,
                responses: { "200": ok("#/components/schemas/NewsList") },
            },
        },
        "/api/v2/news/{alias}": {
            get: {
                tags: ["Новости"],
                summary: "Отдельная новость",
                parameters: [{ name: "alias", in: "path", required: true, schema: { type: "string" } }],
                responses: { "200": ok("#/components/schemas/News"), "404": errorResponse("Новость не найдена") },
            },
        },
        "/api/v2/imeniny": {
            get: {
                tags: ["Справочники"],
                summary: "Указатель имён",
                description: "По какому имени в святцах есть кого поминать. Отбор — по началу имени.",
                parameters: [
                    { name: "q", in: "query", required: false, schema: { type: "string" }, example: "ан", description: "Начало имени" },
                    ...pageParams,
                ],
                responses: { "200": ok("#/components/schemas/NameList") },
            },
        },
        "/api/v2/imeniny/{name}": {
            get: {
                tags: ["Справочники"],
                summary: "Кого поминают под этим именем и когда",
                description:
                    "Даты приведены к гражданскому календарю запрошенного года: в святцах они "
                    + "записаны числом старого стиля либо смещением от Пасхи, и второе без "
                    + "пасхалии не разложить.\n\nПравило именин — народный обычай, а не устав; "
                    + "оговорка приходит в самом ответе полем caveat.",
                parameters: [
                    { name: "name", in: "path", required: true, schema: { type: "string" }, example: "Анна" },
                    { name: "year", in: "query", required: false, schema: { type: "integer", minimum: 1900, maximum: 2099 }, description: "Год, в котором раскладываются даты; по умолчанию нынешний" },
                    { name: "born", in: "query", required: false, schema: { type: "string", pattern: "^\\d{1,2}-\\d{1,2}$" }, example: "03-15", description: "Месяц и число рождения — чтобы посчитать именины" },
                ],
                responses: {
                    "200": ok("#/components/schemas/NameEntry"),
                    "400": errorResponse("Имя короче двух букв или закодировано неверно"),
                    "404": errorResponse("Такого имени в указателе нет"),
                },
            },
        },
        "/api/v2/chronology": {
            get: {
                tags: ["Справочники"],
                summary: "Разбор летописной датировки",
                description:
                    "Перебор по условиям записи: лето, индикт, круги Солнцу и Луне, вруцелето, "
                    + "основание, эпакта, ключ границ, день недели, месяц и число.\n\nОтвечает "
                    + "не «вот год», а что уцелело и что чему противоречит: запись, не сошедшаяся "
                    + "ни на одном годе, — законный ответ, он значит описку в источнике, и тогда "
                    + "возвращаются поправки.\n\nУсловия, которые назвали, но прочесть не "
                    + "удалось, перечислены в ignored: в переборе они не участвовали.",
                parameters: [
                    { name: "leto", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 9999 }, example: 6712 },
                    { name: "indikt", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 15 } },
                    { name: "krugSolntsu", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 28 } },
                    { name: "krugLune", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 19 } },
                    { name: "vrutseleto", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 7 } },
                    { name: "osnovanie", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 30 } },
                    { name: "epakta", in: "query", required: false, schema: { type: "integer", minimum: 0, maximum: 30 } },
                    { name: "klyuchGranits", in: "query", required: false, schema: { type: "string" }, example: "З" },
                    { name: "weekday", in: "query", required: false, schema: { type: "string", enum: [...WEEKDAYS] } },
                    { name: "month", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 12 }, description: "Только вместе с day" },
                    { name: "day", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 31 } },
                    { name: "from", in: "query", required: false, schema: { type: "integer" }, description: "Начало перебора, по умолчанию 988" },
                    { name: "to", in: "query", required: false, schema: { type: "integer" }, description: "Конец перебора, по умолчанию 1700; шире 1200 лет за раз не считаем" },
                ],
                responses: {
                    "200": ok("#/components/schemas/ChronologyAnswer"),
                    "400": errorResponse("Не названо ни одного условия либо промежуток задан неверно"),
                },
            },
        },
        "/api/v2/dictionary": {
            get: {
                tags: ["Справочники"],
                summary: "Поиск по словарю церковнославянского",
                parameters: [
                    { name: "q", in: "query", required: true, schema: { type: "string", minLength: 3 }, example: "земл" },
                    ...pageParams,
                ],
                responses: {
                    "200": ok("#/components/schemas/LexemeList"),
                    "400": errorResponse("Запрос слишком короткий"),
                },
            },
        },
        "/api/v2/dictionary/{id}": {
            get: {
                tags: ["Справочники"],
                summary: "Словарная статья с парадигмой",
                description:
                    "Парадигма — плоский список ячеек; имена ячеек грамматические («sgNom», "
                    + "«aorPl3», «partPastPass»), порядок осмысленный.\n\nУ каждой формы стоит "
                    + "stored: выписана она в словаре или порождена по таблице склонения. Это "
                    + "разница между фактом и выводом, и схлопывать её не следует.",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
                responses: {
                    "200": ok("#/components/schemas/Lexeme"),
                    "400": errorResponse("Неверный идентификатор"),
                    "404": errorResponse("Такого слова в словаре нет"),
                },
            },
        },
        "/api/v2/saints/dossier/{address}": {
            get: {
                tags: ["Справочники"],
                summary: "Досье святого",
                description:
                    "Запись каталога и всё, что к ней привязано: дни памяти в гражданских "
                    + "датах, памяти месяцеслова со знаком службы, тексты и упоминания, "
                    + "акафисты, посвящения храмов, связь с родословной.\n\nАдрес — наш слуг "
                    + "либо, для старых ссылок, номер памяти в святцах: номерами святые "
                    + "подписаны в разметке самих текстов корпуса.\n\nТексты собираются по "
                    + "всем номерам записи: одно лицо календарь держит порознь двумя "
                    + "памятями.\n\nПустой раздел чаще значит «связь не проставлена», чем "
                    + "«нет» — об этом говорит поле caveat. akathists: null означает, что "
                    + "корпус на сервере не выложен и акафисты не смотрели вовсе; [] — "
                    + "смотрели и не нашли.",
                parameters: [
                    { name: "address", in: "path", required: true, schema: { type: "string" }, example: "zahariya-i-elisaveta" },
                ],
                responses: {
                    "200": ok("#/components/schemas/SaintDossier"),
                    "400": errorResponse("Адрес не указан или закодирован неверно"),
                    "404": errorResponse("Такого святого в каталоге нет"),
                },
            },
        },
        "/api/v2/saints/{id}": {
            get: {
                tags: ["Справочники"],
                summary: "Тексты, связанные со святым",
                description: "Идентификатор — из святцев dneslov.org. Сведения о самом святом берите там же.",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" }, example: "3030" }],
                responses: { "200": ok("#/components/schemas/SaintTexts"), "404": errorResponse("Текстов не найдено") },
            },
        },
        "/api/v2/pomyannik/vocabulary": {
            get: {
                tags: ["Помянник"],
                summary: "Чины и виды поминовения",
                description:
                    "Закрытые списки помянника. Отдаются ручкой, а не переписываются клиентом: "
                    + "у пяти помет церковнославянского начертания в наших книгах не нашлось, и "
                    + "`cs: null` там значит «не знаем», а не «нет». Копия на стороне клиента — "
                    + "это второе место, где кто-нибудь заполнит пробел, и тогда в записке будет "
                    + "напечатано выдуманное за книгу.",
                responses: { "200": ok("#/components/schemas/PomyannikVocabulary") },
            },
        },
        "/api/v2/pomyannik/calendar": {
            get: {
                tags: ["Помянник"],
                summary: "Поминальные дни года",
                description:
                    "Дни общие и от помянника не зависят, поэтому входа не требуют. Часть из них "
                    + "помечена `custom`: они не по Типикону, а по определению Собора, указу или "
                    + "местному обычаю, и Димитриевская суббота вдобавок считается в разных "
                    + "митрополиях неодинаково.",
                parameters: [{
                    name: "year", in: "query", required: false,
                    schema: { type: "integer", minimum: 1900, maximum: 2099 },
                    description: "Год; по умолчанию нынешний",
                }],
                responses: {
                    "200": ok("#/components/schemas/MemorialDays"),
                    "400": errorResponse("Год вне промежутка 1900–2099"),
                },
            },
        },
        "/api/v2/pomyannik/persons": {
            get: {
                tags: ["Помянник"],
                summary: "Помянник целиком",
                description:
                    "Нужен вход. Со страницы этой документации не выполнится: сессия ездит в "
                    + "куке, которой у неё нет — ручка не сломана.",
                security: personal,
                parameters: [
                    {
                        name: "kind", in: "query", required: false,
                        schema: { type: "string", enum: ["living", "departed"] },
                        description: "Разворот: о здравии или о упокоении",
                    },
                    ...pageParams,
                ],
                responses: {
                    "200": ok("#/components/schemas/PersonList"),
                    "401": needsSession,
                },
            },
            post: {
                tags: ["Помянник"],
                summary: "Записать имена",
                description:
                    "Нужен вход. Одно лицо объектом или несколько в `persons`. Повторов не "
                    + "отсеиваем: двух Николаев в роду не редкость, и молча слить их значило бы "
                    + "решить за человека, что один из них лишний.",
                security: personal,
                requestBody: sends("#/components/schemas/PersonInput"),
                responses: {
                    "201": ok("#/components/schemas/PersonsCreated", "Имена записаны"),
                    "400": errorResponse("Тело не разобрано или имени в присланном не нашлось"),
                    "401": needsSession,
                    "409": errorResponse("В помяннике больше имён не помещается"),
                },
            },
        },
        "/api/v2/pomyannik/persons/{id}": {
            get: {
                tags: ["Помянник"],
                summary: "Лицо и счёт по нему",
                description:
                    "Нужен вход. Третий, девятый и сороковой день считаются здесь, а не клиентом: "
                    + "день преставления считается первым, и повторённый на той стороне счёт "
                    + "ошибётся на день. Поле `on` — число, на которое посчитано: «новопреставленный» "
                    + "живёт сорок дней и протухает сам собою.",
                security: personal,
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
                responses: {
                    "200": ok("#/components/schemas/PersonCard"),
                    "401": needsSession,
                    "404": errorResponse("Такого имени в вашем помяннике нет"),
                },
            },
            put: {
                tags: ["Помянник"],
                summary: "Поправить лицо",
                description:
                    "Нужен вход. Правка приходит ЦЕЛЫМ ЛИЦОМ, а не по полю: иначе пришлось бы "
                    + "решать, что значит отсутствующее поле — «не трогай» или «сотри», — и на "
                    + "этом вопросе рано или поздно теряется дата преставления.",
                security: personal,
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
                requestBody: sends("#/components/schemas/PersonInput"),
                responses: {
                    "200": ok("#/components/schemas/PersonSaved"),
                    "400": errorResponse("Тело не разобрано"),
                    "401": needsSession,
                    "404": errorResponse("Такого имени в вашем помяннике нет"),
                },
            },
            delete: {
                tags: ["Помянник"],
                summary: "Убрать имя",
                security: personal,
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
                responses: {
                    "200": ok("#/components/schemas/Deleted"),
                    "401": needsSession,
                    "404": errorResponse("Такого имени в вашем помяннике нет"),
                },
            },
        },
        "/api/v2/pomyannik/zapiski": {
            get: {
                tags: ["Помянник"],
                summary: "Что вы подавали",
                description: "Нужен вход. После чистки по сроку остаётся запись без имён.",
                security: personal,
                parameters: pageParams,
                responses: { "200": ok("#/components/schemas/ZapiskaList"), "401": needsSession },
            },
            post: {
                tags: ["Помянник"],
                summary: "Подать записку священнику",
                description:
                    "Нужен вход. Имена берутся из вашего помянника по их идентификаторам, а не из "
                    + "тела запроса, — иначе проверка имён не значила бы ничего. Приход по "
                    + "коду-приглашению, какой священник раздаёт сам, либо по слугу его открытой "
                    + "страницы. Оплат нет: записку принимает священник, а не храм.",
                security: personal,
                requestBody: sends("#/components/schemas/NoteRequest"),
                responses: {
                    "201": ok("#/components/schemas/SentNote", "Записка подана"),
                    "400": errorResponse(
                        "Неизвестный вид, пустой список имён, панихида о живых или молебен об "
                        + "усопших, либо этот вид поминовения не принимают",
                    ),
                    "401": needsSession,
                    "404": errorResponse("Приём не найден"),
                    "429": errorResponse("Слишком часто: записок принимается двадцать в час"),
                },
            },
        },
        "/api/v2/pomyannik/prinyatye": {
            get: {
                tags: ["Помянник"],
                summary: "Поданные вам записки",
                description:
                    "Нужен вход и открытый приём. Неразобранные сверху — порядок задаёт сервер, "
                    + "пересортировывать не надо. Кто подал, в ответе не значится: читающему это "
                    + "не нужно, а это личность третьего лица.",
                security: personal,
                parameters: pageParams,
                responses: {
                    "200": ok("#/components/schemas/Prinyatye"),
                    "401": needsSession,
                    "403": errorResponse("Приём записок вам пока не открыт"),
                },
            },
        },
        "/api/v2/pomyannik/prinyatye/{id}": {
            patch: {
                tags: ["Помянник"],
                summary: "Отметить записку",
                description:
                    "Нужен вход. Прочтение обратно не снимается. `404` и «уже отмечено» "
                    + "неразличимы нарочно: по ответу нельзя узнать, существует ли чужая записка.",
                security: personal,
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
                requestBody: sends("#/components/schemas/NoteMark"),
                responses: {
                    "200": ok("#/components/schemas/Ok"),
                    "400": errorResponse("Отметить можно «read» или «finished»"),
                    "401": needsSession,
                    "404": errorResponse("Такой записки нет или она уже отмечена"),
                },
            },
        },
        "/api/v2/pomyannik/name": {
            get: {
                tags: ["Помянник"],
                summary: "Сверить имя до записи",
                description:
                    "Нужен вход. Помянник хранит СЛОВАРНУЮ форму: от неё зависят память в "
                    + "святцах, сверка наречения и склонение для записки. Написанное косвенным "
                    + "падежом — «о здравии Анны», как помянник и читают вслух, — молча "
                    + "отказывает во всех трёх. Подсказка не применяется сама: «Иоанна» — и "
                    + "родительный от «Иоанн», и самостоятельное женское имя.",
                security: personal,
                parameters: [{
                    name: "q", in: "query", required: true,
                    schema: { type: "string" }, example: "Анны",
                }],
                responses: {
                    "200": ok("#/components/schemas/NameCheck"),
                    "400": errorResponse("Нечего сверять"),
                    "401": needsSession,
                },
            },
        },
        "/api/v2/pomyannik/note/preview": {
            post: {
                tags: ["Помянник"],
                summary: "Записка до подачи",
                description:
                    "Нужен вход. Тот же лист, что уйдёт священнику, и собран он тем же кодом — "
                    + "иначе предпросмотр и поданное разошлись бы. Церковнославянский родительный "
                    + "падеж считается здесь: за ним стоит словарь личных имён и склонение по "
                    + "схеме. Поле `slavonicSource` показывать обязательно: «lexicon» значит "
                    + "настоящий родительный, прочее — что падеж остался прежним, и выдать это за "
                    + "проверенный — худшее, что здесь возможно.",
                security: personal,
                requestBody: sends("#/components/schemas/NotePreviewRequest"),
                responses: {
                    "200": ok("#/components/schemas/NoteSheet"),
                    "400": errorResponse(
                        "Неизвестный вид, пустой список имён, панихида о живых или молебен об усопших",
                    ),
                    "401": needsSession,
                },
            },
        },
        "/api/v2/pomyannik/upcoming": {
            get: {
                tags: ["Помянник"],
                summary: "Ближайшие поминальные дни",
                description:
                    "Нужен вход. Годовщины, именины, третий, девятый и сороковой дни, окончание "
                    + "сорокоуста и общие поминальные субботы — в одном порядке по датам. Общие дни "
                    + "прибавляются только тогда, когда в помяннике есть кого поминать.",
                security: personal,
                parameters: [
                    {
                        name: "days", in: "query", required: false,
                        schema: { type: "integer", default: 60, minimum: 1, maximum: 400 },
                        description: "Ширина окна в днях",
                    },
                    {
                        name: "from", in: "query", required: false,
                        schema: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
                        description:
                            "С какого дня считать; по умолчанию сегодняшний по времени сервера. "
                            + "Ответ несёт это число обратно: подвижные памяти и годовщины "
                            + "считаются от него, и окно, посчитанное вчера, начинается вчера.",
                    },
                ],
                responses: {
                    "200": ok("#/components/schemas/UpcomingEvents"),
                    "400": errorResponse("Дата начала записана не как ГГГГ-ММ-ДД"),
                    "401": needsSession,
                },
            },
        },
    },
    components: {
        securitySchemes: {
            apiKey: {
                type: "http",
                scheme: "bearer",
                description:
                    `Ключ доступа, выпускается в профиле на ${SITE_HOST}. Даёт больший лимит и ` +
                    "открывает поиск. Запасной вид — заголовок X-Api-Key с тем же значением.",
            },
            cookieAuth: {
                type: "apiKey",
                in: "cookie",
                name: "session",
                description:
                    "Вход на сайте. Нужен только помяннику — там ключ отмеряет частоту, а чей "
                    + "список открывать, говорит сессия. Своим ключом чужой помянник не открыть.",
            },
        },
        schemas: {
            Error: {
                type: "object",
                properties: {
                    error: {
                        type: "object",
                        properties: {
                            code: { type: "string", enum: [...ERROR_CODES] },
                            message: { type: "string" },
                        },
                    },
                },
            },
            Service: { type: "object", description: "Описание сервиса, счётчики и условия использования" },

            // --- Помянник -------------------------------------------------
            RankInfo: {
                type: "object",
                description: "Чин или помета, с какими имя читается в записке",
                properties: {
                    key: { type: "string", example: "ierey" },
                    label: { type: "string", description: "Как пишется в помяннике", example: "иерей" },
                    genitive: { type: "string", description: "Родительный падеж — так пишут в записке", example: "иерея" },
                    cs: {
                        type: ["string", "null"],
                        description:
                            "Он же церковнославянским письмом. `null` значит «книгой не "
                            + "подтверждено», а не «нет формы»: пять помет — «болящий», "
                            + "«путешествующий», «заключённый», «непраздная», «убиенный» — в "
                            + "словаре лексем не нашлись, и придумывать за книгу мы не станем. "
                            + "Записка обязана поставить такую помету гражданкой и сказать об этом.",
                        example: "їере́а",
                    },
                    feminine: {
                        type: ["object", "null"],
                        description: "Женская форма, если она отдельная",
                        properties: {
                            label: { type: "string" },
                            genitive: { type: "string" },
                            cs: { type: ["string", "null"] },
                        },
                    },
                    only: {
                        type: ["string", "null"],
                        enum: ["living", "departed", null],
                        description: "Только живым или только усопшим; пусто — всё равно",
                    },
                },
            },
            NoteKindInfo: {
                type: "object",
                description: "Вид поминовения. Он же решает, кого можно вписать в записку",
                properties: {
                    key: { type: "string", example: "panihida" },
                    label: { type: "string", example: "Панихида" },
                    about: {
                        type: "string", enum: ["living", "departed", "both"],
                        description: "Панихида о живых не служится, молебен об усопших — тоже",
                    },
                    days: { type: "integer", description: "Сколько дней длится поминовение; 0 — разовое" },
                    note: { type: "string" },
                },
            },
            PomyannikVocabulary: {
                type: "object",
                properties: {
                    ranks: { type: "array", items: { $ref: "#/components/schemas/RankInfo" } },
                    noteKinds: { type: "array", items: { $ref: "#/components/schemas/NoteKindInfo" } },
                    limits: {
                        type: "object",
                        properties: {
                            maxPersons: { type: "integer", description: "Сколько имён держит помянник" },
                            maxBatch: { type: "integer", description: "Сколько имён принимается за раз" },
                            maxNamesInNote: { type: "integer", description: "Больше — уже не записка, а помянник" },
                        },
                    },
                },
            },
            NameDay: {
                type: "object",
                description: "Именины. Памяти здесь двух родов, и хранятся они по-разному",
                properties: {
                    source: {
                        type: "string", enum: ["auto", "manual"],
                        description: "Посчитано по дню рождения и святцам или названо человеком",
                    },
                    style: {
                        type: ["string", "null"], enum: ["old", "new", null],
                        description:
                            "В каком календаре записаны месяц и число. `old` — как в святцах: "
                            + "сдвиг календарей ложится в разные годы по-разному, и заранее "
                            + "переведённое число однажды разошлось бы с месяцесловом.",
                    },
                    month: { type: ["integer", "null"] },
                    day: { type: ["integer", "null"] },
                    offset: {
                        type: ["integer", "null"],
                        description: "Подвижная память: смещение от Пасхи в днях. Числа у неё нет вовсе",
                    },
                    saint: { type: ["string", "null"], description: "Кого именно поминают" },
                },
            },
            Person: {
                type: "object",
                description: "Лицо помянника",
                properties: {
                    id: { type: "string" },
                    name: { type: "string", description: "Как ввёл человек; его написание мы не переписываем" },
                    churchName: { type: ["string", "null"], description: "Имя наречения, если оно другое", example: "Георгий" },
                    kind: { type: "string", enum: ["living", "departed"] },
                    sex: { type: ["string", "null"], enum: ["m", "f", null] },
                    rank: { type: ["string", "null"], description: "Ключ чина из словаря" },
                    relation: {
                        type: ["string", "null"],
                        description:
                            "«Мама», «крёстный» — для хозяина помянника, чтобы не спутать двух "
                            + "Николаев. В записку не идёт: там поминают по имени, а не по родству.",
                    },
                    born: { type: ["string", "null"], format: "date" },
                    baptized: { type: ["string", "null"], format: "date" },
                    died: { type: ["string", "null"], format: "date" },
                    nameDay: { oneOf: [{ $ref: "#/components/schemas/NameDay" }, { type: "null" }] },
                    sorokoust: {
                        type: ["object", "null"],
                        description: "Заказанный сорокоуст: сорок литургий подряд со дня заказа",
                        properties: {
                            from: { type: "string", format: "date" },
                            where: { type: ["string", "null"] },
                        },
                    },
                    groups: { type: "array", items: { type: "string" } },
                    order: { type: "integer" },
                },
            },
            PersonList: collection("#/components/schemas/Person"),
            MemorialCount: {
                type: ["object", "null"],
                description:
                    "Дни поминовения усопшего. День преставления считается первым, оттого третий "
                    + "день — через двое суток, девятый — через восемь, сороковой — через тридцать "
                    + "девять. Счёт этот повсеместный, но он обычай счисления, а не уставное "
                    + "предписание, и клиенту следует сказать об этом словами.",
                properties: {
                    third: { type: "string", format: "date" },
                    ninth: { type: "string", format: "date" },
                    fortieth: { type: "string", format: "date" },
                    newlyDeparted: {
                        type: "boolean",
                        description: "Идут ли ещё сорок дней. Считается, а не хранится: помета сама протухает",
                    },
                    years: { type: "integer", description: "Полных лет со дня преставления" },
                },
            },
            SorokoustSpan: {
                type: ["object", "null"],
                description:
                    "Сорокоуст — НЕ сороковой день: он считается со дня заказа, и заказанный на "
                    + "девятый день кончится на сорок восьмой.",
                properties: {
                    from: { type: "string", format: "date" },
                    to: { type: "string", format: "date", description: "Последний, сороковой день поминовения" },
                    passed: { type: "integer", description: "Сколько дней прошло, считая сегодняшний" },
                    left: { type: "integer" },
                    done: {
                        type: "boolean",
                        description:
                            "В самый сороковой день — ещё нет: литургию этого дня служат, и "
                            + "«окончено», пока имя читают, было бы неправдой.",
                    },
                },
            },
            PersonCard: {
                type: "object",
                properties: {
                    on: {
                        type: "string", format: "date",
                        description:
                            "На какое число посчитано. Всё ниже — «на сегодня» и протухает в "
                            + "полночь: карточку, пролежавшую открытой через полночь, надо "
                            + "перезапросить.",
                    },
                    person: { $ref: "#/components/schemas/Person" },
                    memorial: { $ref: "#/components/schemas/MemorialCount" },
                    sorokoust: { $ref: "#/components/schemas/SorokoustSpan" },
                },
            },
            UpcomingEvent: {
                type: "object",
                properties: {
                    date: { type: "string", format: "date" },
                    kind: {
                        type: "string",
                        enum: ["nameday", "birthday", "anniversary", "third", "ninth",
                               "fortieth", "sorokoust-end", "memorial-day"],
                    },
                    personId: { type: ["string", "null"], description: "Пусто у общих поминальных дней" },
                    name: { type: ["string", "null"] },
                    years: { type: ["integer", "null"], description: "Который год или день — у годовщин" },
                    title: { type: "string", example: "Сороковой день: Николай" },
                    custom: { type: "boolean", description: "День не уставный — помету обязан донести и клиент" },
                    note: { type: ["string", "null"] },
                },
            },
            UpcomingEvents: {
                type: "object",
                properties: {
                    from: { type: "string", format: "date", description: "С какого дня посчитано" },
                    days: { type: "integer" },
                    events: { type: "array", items: { $ref: "#/components/schemas/UpcomingEvent" } },
                },
            },
            MemorialDay: {
                type: "object",
                properties: {
                    date: { type: "string", format: "date" },
                    name: { type: "string", example: "Радоница" },
                    custom: { type: "boolean", description: "Не по Типикону: определение Собора, указ или местный обычай" },
                    note: { type: ["string", "null"] },
                },
            },
            MemorialDays: {
                type: "object",
                properties: {
                    year: { type: "integer" },
                    days: { type: "array", items: { $ref: "#/components/schemas/MemorialDay" } },
                },
            },
            PersonInput: {
                type: "object",
                required: ["name"],
                description:
                    "Что принимается на запись и на правку. На правке — лицо ЦЕЛИКОМ: "
                    + "отсутствующее поле здесь значит «стереть», а не «не трогать». Чин — ключ "
                    + "из словаря; дата преставления сама переносит лицо на заупокойный разворот.",
                properties: {
                    name: { type: "string", maxLength: 60 },
                    churchName: { type: ["string", "null"], maxLength: 60 },
                    kind: { type: "string", enum: ["living", "departed"] },
                    sex: { type: ["string", "null"], enum: ["m", "f", null] },
                    rank: { type: ["string", "null"] },
                    relation: { type: ["string", "null"], maxLength: 60 },
                    born: { type: ["string", "null"], format: "date" },
                    baptized: { type: ["string", "null"], format: "date" },
                    died: { type: ["string", "null"], format: "date" },
                    nameDay: { oneOf: [{ $ref: "#/components/schemas/NameDay" }, { type: "null" }] },
                    sorokoust: {
                        type: ["object", "null"],
                        properties: {
                            from: { type: "string", format: "date" },
                            where: { type: ["string", "null"] },
                        },
                    },
                    persons: {
                        type: "array",
                        description: "Пачкой: несколько лиц за раз, вместо одного в корне",
                        items: { $ref: "#/components/schemas/PersonInput" },
                    },
                },
            },
            PersonsCreated: {
                type: "object",
                properties: { items: { type: "array", items: { $ref: "#/components/schemas/Person" } } },
            },
            PersonSaved: {
                type: "object",
                properties: { person: { $ref: "#/components/schemas/Person" } },
            },
            Deleted: { type: "object", properties: { deleted: { type: "boolean" } } },
            Ok: { type: "object", properties: { ok: { type: "boolean" } } },
            NameCheck: {
                type: "object",
                properties: {
                    name: { type: "string", description: "Написание, приведённое к обычному виду" },
                    key: { type: "string", description: "Ключ указателя: без ударений и «ё»" },
                    status: {
                        type: "string", enum: ["known", "civil", "unknown"],
                        description:
                            "`known` — имя есть в святцах; `civil` — есть подсказка (имя "
                            + "наречения либо словарная форма вместо косвенного падежа); "
                            + "`unknown` — не нашлось. Незнакомое ПРИНИМАЕТСЯ: указатель "
                            + "выведен нами и неполон, и отвергать по нему имя человека нельзя.",
                    },
                    suggestions: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                name: { type: "string" },
                                why: {
                                    type: "string",
                                    description: "Довод, по которому решает человек: «похоже на "
                                        + "родительный падеж», «имя наречения», «похоже на описку»",
                                },
                            },
                        },
                    },
                    slavonic: {
                        type: "object",
                        properties: {
                            text: { type: "string" },
                            genitive: { type: "string" },
                            source: { type: "string", enum: ["lexicon", "accents", "plain"] },
                            lexeme: { type: ["string", "null"] },
                        },
                    },
                },
            },
            NoteName: {
                type: "object",
                description: "Имя в записке — снимок помянника на минуту подачи, а не ссылка на него",
                properties: {
                    name: { type: "string", description: "Как написано у подавшего" },
                    churchName: { type: ["string", "null"] },
                    slavonic: { type: ["string", "null"], description: "Церковнославянское начертание в родительном падеже" },
                    slavonicSource: {
                        type: ["string", "null"],
                        enum: ["lexicon", "accents", "plain", null],
                        description:
                            "Откуда взялось написание. `lexicon` — склонено по словарной схеме, "
                            + "это настоящий родительный. `accents` — имени в словаре нет: письмо "
                            + "и ударение наши, а падеж остался прежним. `plain` — перевести в "
                            + "церковное письмо не смогли. Показывать обязательно: приняв наш "
                            + "именительный за проверенный родительный, человек отдаст записку с "
                            + "ошибкой, которой сам бы не сделал.",
                    },
                    kind: { type: "string", enum: ["living", "departed"] },
                    rank: { type: ["string", "null"] },
                    sex: { type: ["string", "null"], enum: ["m", "f", null] },
                },
            },
            NotePreviewRequest: {
                type: "object",
                required: ["kind", "personIds"],
                properties: {
                    kind: { type: "string", description: "Ключ вида поминовения из словаря" },
                    personIds: { type: "array", items: { type: "string" }, maxItems: 20 },
                },
            },
            NoteRequest: {
                type: "object",
                required: ["kind", "personIds"],
                description: "Кому подаётся — кодом-приглашением или слугом открытой страницы",
                properties: {
                    kind: { type: "string" },
                    personIds: { type: "array", items: { type: "string" }, maxItems: 20 },
                    code: { type: "string", description: "Код-приглашение, какой священник раздаёт сам" },
                    slug: { type: "string", description: "Слуг открытой страницы приёма" },
                },
            },
            NoteMark: {
                type: "object",
                required: ["mark"],
                properties: { mark: { type: "string", enum: ["read", "finished"] } },
            },
            NoteSheet: {
                type: "object",
                description: "Записка до подачи — тот же лист, что уйдёт священнику",
                properties: {
                    kind: { $ref: "#/components/schemas/NoteKindInfo" },
                    span: {
                        type: ["object", "null"],
                        description:
                            "Срок длящегося поминовения, посчитанный на сегодня. На день подачи "
                            + "он сдвинется: считается он от дня подачи, а она ещё не случилась.",
                        properties: {
                            from: { type: "string", format: "date" },
                            to: { type: "string", format: "date" },
                        },
                    },
                    names: { type: "array", items: { $ref: "#/components/schemas/NoteName" } },
                },
            },
            Zapiska: {
                type: "object",
                description:
                    "Поданная записка. Стёртая по сроку приходит с пустыми именами и непустым "
                    + "`namesCount`: «было столько-то» переживает чистку нарочно, а сами имена — нет.",
                properties: {
                    id: { type: "string" },
                    kind: { type: "string" },
                    names: { type: "array", items: { $ref: "#/components/schemas/NoteName" } },
                    namesCount: { type: "integer" },
                    span: {
                        type: ["object", "null"],
                        properties: {
                            from: { type: "string", format: "date" },
                            to: { type: "string", format: "date" },
                        },
                    },
                    createdAt: { type: ["string", "null"], format: "date-time" },
                    readAt: { type: ["string", "null"], format: "date-time" },
                    finishedAt: { type: ["string", "null"], format: "date-time" },
                    sweptAt: { type: ["string", "null"], format: "date-time" },
                },
            },
            ZapiskaList: collection("#/components/schemas/Zapiska"),
            SentNote: {
                type: "object",
                properties: {
                    note: { $ref: "#/components/schemas/Zapiska" },
                    to: { type: "object", properties: { title: { type: "string" } } },
                },
            },
            Prinyatye: {
                type: "object",
                properties: {
                    items: { type: "array", items: { $ref: "#/components/schemas/Zapiska" } },
                    total: { type: "integer" },
                    limit: { type: "integer" },
                    offset: { type: "integer" },
                    unread: { type: "integer", description: "Сколько ещё не отмечено прочитанными" },
                    commemorator: {
                        type: "object",
                        properties: {
                            title: { type: "string", example: "иерей Николай Петров" },
                            place: { type: ["string", "null"] },
                        },
                    },
                },
            },
            AccentVariant: {
                type: "object",
                description: "Одно положение ударения в слове",
                properties: {
                    vowel: {
                        type: "integer",
                        description:
                            "Номер ударной гласной, считая с нуля. Не позиция символа: та зависит "
                            + "от того, разложены ли ї и й, а номер гласной не зависит.",
                    },
                    mark: { type: "string", description: "Сам знак: U+0301 оксия, U+0300 вария, U+0311 камора" },
                    markName: { type: "string", enum: ["оксия", "вария", "камора"] },
                    spelling: { type: "string", description: "Как это написано", example: "землѝ" },
                    count: { type: "integer", description: "Сколько раз так написано — в своём источнике" },
                    share: { type: "number", description: "Доля среди написаний этого слова внутри того же источника" },
                    lexeme: { type: "string", description: "Только у словарных вариантов: словарная форма", example: "земля́" },
                    properties: { type: "string", description: "Только у словарных вариантов: грамматические пометы", example: "sg,gen/dat/loc" },
                    forms: { type: "integer", description: "Только у словарных вариантов: сколько форм парадигмы дали это положение" },
                },
            },
            Accent: {
                type: "object",
                description:
                    "Ударение слова из трёх источников. corpus — употребление в книжных чтениях "
                    + "с частотами; chants — в гимнографии (Октоих, Минеи, Триоди, Часослов), тоже "
                    + "с частотами; lexicon — порождённые парадигмы словаря церковнославянского "
                    + "с грамматикой. Источники пересекаются лишь частично, поэтому пустой corpus "
                    + "при непустом chants (и любое другое сочетание) — обычное дело.\n\n"
                    + "Частоты corpus и chants НЕ складываются: жанр переворачивает большинство. "
                    + "«Спасе» в чтениях — аорист «спасе́» (50 раз), в песнопениях — звательный "
                    + "«спа́се» (2024). Берите источник, отвечающий вашему тексту.\n\n"
                    + "Словарь описательный, а не нормативный: он говорит, как слово размечено "
                    + "в этих собраниях, а не как правильно.",
                properties: {
                    word: { type: "string", description: "Слово, как его прислали" },
                    known: { type: "boolean" },
                    agree: {
                        type: ["boolean", "null"],
                        description:
                            "Ставят ли все знающие слово источники ударение на одну гласную; "
                            + "null — знает только один, спорить не с чем. "
                            + "false не обязательно означает ошибку: «зе́мли» (мн. им.) и «землѝ» (ед. род.) "
                            + "оба верны и пишутся одинаково без знаков.",
                    },
                    corpus: { type: "array", items: { $ref: "#/components/schemas/AccentVariant" } },
                    chants: { type: "array", items: { $ref: "#/components/schemas/AccentVariant" } },
                    lexicon: { type: "array", items: { $ref: "#/components/schemas/AccentVariant" } },
                },
            },
            AccentBatch: {
                type: "object",
                description: "Ответ пачкой либо сводка по словарю, если words не задан",
                properties: {
                    items: { type: "array", items: { $ref: "#/components/schemas/Accent" } },
                    total: { type: "integer" },
                    known: { type: "integer", description: "Сколько из них нашлось" },
                },
            },
            Text: {
                type: "object",
                description: "Текст в списке — без содержимого",
                properties: {
                    id: { type: "string" },
                    alias: { type: ["string", "null"], description: "Постоянный адрес текста" },
                    name: { type: "string" },
                    description: { type: ["string", "null"] },
                    author: { type: ["string", "null"] },
                    translator: { type: ["string", "null"] },
                    type: { type: ["string", "null"] },
                    readiness: { type: ["string", "null"], description: "ready — вычитан; presence — есть только скан" },
                    bookId: { type: ["string", "null"] },
                    bookIndex: { type: ["integer", "null"] },
                    dneslovId: { type: ["string", "null"] },
                    updatedAt: { type: ["string", "null"], format: "date-time" },
                },
            },
            TextDetail: {
                allOf: [
                    { $ref: "#/components/schemas/Text" },
                    {
                        type: "object",
                        properties: {
                            content: { type: "string", description: "Тело текста. Абзацы разделены двумя переводами строки" },
                            poems: { type: ["string", "null"] },
                            footnotes: { type: "array", items: { type: "object" } },
                            scanUrl: { type: ["string", "null"], description: "Ссылка на скан оригинала — чужой материал" },
                            russianUrl: { type: ["string", "null"], description: "Ссылка на русский перевод — чужой материал" },
                            note: { type: ["string", "null"] },
                            mentionIds: { type: "array", items: { type: "string" } },
                        },
                    },
                ],
            },
            Verse: {
                type: "object",
                properties: {
                    id: { type: "string" },
                    chapter: { type: "integer" },
                    verse: { type: "integer" },
                    content: { type: "string" },
                },
            },
            SaintDossier: {
                type: "object",
                properties: {
                    slug: { type: ["string", "null"] },
                    name: { type: ["string", "null"] },
                    altNames: { type: "array", items: { type: "string" } },
                    kind: { type: ["string", "null"] },
                    kindLabel: { type: ["string", "null"] },
                    orders: { type: "array", items: { type: "object" } },
                    baseYear: { type: ["integer", "null"] },
                    baseYearLabel: { type: ["string", "null"] },
                    memoryDates: {
                        type: "array", items: { type: "object" },
                        description: "Дни памяти, разложенные в гражданский календарь; переходящие у святцев записаны смещением",
                    },
                    roundelUrl: { type: ["string", "null"] },
                    images: { type: "array", items: { type: "object" } },
                    externals: { type: "array", items: { type: "object" }, description: "Номеров святцев у записи бывает несколько" },
                    memories: { type: "array", items: { type: "object" }, description: "Памяти месяцеслова со знаком службы" },
                    texts: { type: "array", items: { $ref: "#/components/schemas/Text" } },
                    mentions: { type: "array", items: { $ref: "#/components/schemas/Text" } },
                    akathists: { description: "null — корпус не выложен; [] — не нашли" },
                    dedications: { type: "array", items: { type: "object" } },
                    noble: { description: "Ссылка на родословную; правления не отдаются" },
                    caveat: { type: "string" },
                },
            },
            Name: {
                type: "object",
                properties: {
                    key: { type: "string", description: "Ключ указателя: имя без ударений, строчными" },
                    name: { type: "string" },
                    count: { type: "integer", description: "Сколько святых носит это имя" },
                },
            },
            NameList: collection("#/components/schemas/Name"),
            NameEntry: {
                type: "object",
                properties: {
                    key: { type: "string" },
                    name: { type: "string" },
                    year: { type: "integer", description: "Год, в котором разложены даты" },
                    saints: { type: "array", items: { $ref: "#/components/schemas/NamedSaint" } },
                    memories: { type: "array", items: { $ref: "#/components/schemas/NameMemory" } },
                    nameDay: { description: "Именины по дню рождения; null, если born не назван" },
                    caveat: { type: "string", description: "Чем является правило именин" },
                },
            },
            NamedSaint: {
                type: "object",
                properties: {
                    slug: { type: "string" },
                    name: { type: "string" },
                    confidence: {
                        type: "string", enum: ["sure", "guess"],
                        description: "guess — имя вынуто из соборной памяти, где перечень идёт вперемешку",
                    },
                },
            },
            NameMemory: {
                type: "object",
                properties: {
                    date: { type: "string", format: "date" },
                    movable: { type: "boolean", description: "Подвижная память в другой год придётся на другое число" },
                    saint: { $ref: "#/components/schemas/NamedSaint" },
                },
            },
            ChronologyAnswer: {
                type: "object",
                description: "Что уцелело в переборе и что чему противоречит",
                properties: {
                    record: { type: "object", description: "Условия, как их удалось прочесть" },
                    ignored: { type: "array", items: { type: "string" }, description: "Названное, но не прочтённое: в переборе не участвовало" },
                    searched: { type: "object" },
                    verdict: { type: "object" },
                    considered: { type: "integer" },
                    applied: { type: "array", items: { type: "string" } },
                    survivors: { type: "array", items: { type: "object" } },
                    fixes: { type: "array", items: { type: "object" }, description: "Какое чтение потребовалось бы на месте противоречащего условия" },
                },
            },
            Lexeme: {
                type: "object",
                properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                    scheme: { type: "string" },
                    pos: { type: "string" },
                    properties: { type: "array", items: { type: "string" } },
                    known: { type: "boolean", description: "Есть ли для схемы таблица склонения" },
                    paradigms: { type: "array", items: { type: "object" } },
                    extra: { type: "array", items: { type: "object" }, description: "Формы словаря, не легшие ни в одну ячейку" },
                },
            },
            LexemeList: collection("#/components/schemas/LexemeSummary"),
            LexemeSummary: {
                type: "object",
                properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                    properties: { type: "string", description: "Пометы словаря как есть — «S,m,anim»" },
                    pos: { type: "string" },
                    scheme: { type: "string" },
                },
            },
            BibleBook: {
                type: "object",
                properties: {
                    id: { type: "string", example: "matfeya", description: "Он же — слаг книги в зачалах" },
                    name: { type: "string", example: "От Матфея" },
                    abbr: { type: "string", example: "Мф" },
                    section: {
                        type: "string",
                        enum: [...BIBLE_SECTIONS.map((section) => section.id), "appendix"],
                        description: "Раздел канона; appendix — книга вне славянского канона",
                    },
                    inCanon: { type: "boolean" },
                    chapters: {
                        type: ["integer", "null"],
                        description:
                            "Сколько в книге канонических глав. null у приложения: эталон снят " +
                            "с церковнославянского издания, а этих книг в нём нет вовсе",
                    },
                    note: {
                        type: "string",
                        description: "Откуда книга взялась и почему стоит вне канона; только у приложения",
                    },
                },
            },
            BibleBookList: collection("#/components/schemas/BibleBook"),
            BibleEdition: {
                type: "object",
                properties: {
                    code: { type: "string", description: "Устойчивый код издания: cs-eliz, ro-1688" },
                    title: { type: "string" },
                    shortTitle: { type: "string", description: "Подпись колонки: ЦС, РУМ" },
                    language: { type: "string", description: "Начертание: cu — церковнославянское, ro_cyr — валашская кириллица" },
                    languageCode: { type: "string", enum: ["cs", "ro"], description: "Язык выбора зачал" },
                    versification: { type: "string", description: "Традиция нумерации; sla-lxx — эталон" },
                    year: { type: ["integer", "null"] },
                    sourceUrl: { type: ["string", "null"] },
                },
            },
            BibleEditionList: {
                type: "object",
                properties: {
                    items: { type: "array", items: { $ref: "#/components/schemas/BibleEdition" } },
                    total: { type: "integer" },
                },
            },
            Concordance: {
                type: "object",
                properties: {
                    canonRef: {
                        type: "string", example: "psaltir.9.13",
                        description: "Канонический адрес — тот же, которым названы зачала",
                    },
                    editions: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                edition: { type: "string", example: "ro-1688" },
                                book: { type: "string", description: "Слуг книги В ЭТОМ издании" },
                                places: {
                                    type: "array",
                                    description: "Мест больше одного, если издание разорвало стих",
                                    items: {
                                        type: "object",
                                        properties: {
                                            book: { type: "string" },
                                            chapter: { type: "integer" },
                                            verse: { type: "integer" },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            BibleVerse: {
                type: "object",
                properties: {
                    id: { type: "string" },
                    canonRef: { type: "string", example: "daniila.3.24" },
                    chapter: { type: "integer", description: "Каноническая нумерация" },
                    verse: { type: "integer", description: "Каноническая нумерация" },
                    editionChapter: { type: "integer", description: "Как напечатано в издании" },
                    editionVerse: { type: "integer", description: "Как напечатано в издании" },
                    content: { type: "string" },
                },
            },
            BibleChapter: {
                type: "object",
                properties: {
                    book: {
                        type: "object",
                        properties: {
                            id: { type: "string" },
                            name: { type: "string" },
                            abbr: { type: "string" },
                            section: { type: "string" },
                        },
                    },
                    chapter: { type: "integer" },
                    editions: { type: "array", items: { $ref: "#/components/schemas/BibleEdition" } },
                    verses: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                canonRef: { type: "string" },
                                verse: { type: "integer", description: "Каноническая нумерация" },
                                editions: {
                                    type: "array",
                                    description: "По ячейке на издание, в порядке поля editions; null — стиха в издании нет",
                                    items: { oneOf: [{ $ref: "#/components/schemas/BibleVerse" }, { type: "null" }] },
                                },
                            },
                        },
                    },
                },
            },
            SearchResult: {
                allOf: [
                    { $ref: "#/components/schemas/Text" },
                    { type: "object", properties: { snippet: { type: ["string", "null"], description: "Фрагмент с найденным словом, в исходном написании" } } },
                ],
            },
            Book: {
                type: "object",
                properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                    author: { type: ["string", "null"] },
                    translator: { type: ["string", "null"] },
                    description: { type: ["string", "null"] },
                    textCount: { type: ["integer", "null"] },
                },
            },
            BookDetail: {
                allOf: [
                    { $ref: "#/components/schemas/Book" },
                    { type: "object", properties: { texts: collection("#/components/schemas/Text") } },
                ],
            },
            Day: {
                type: "object",
                properties: {
                    id: { type: "string" },
                    alias: { type: ["string", "null"] },
                    name: { type: "string" },
                    paschal: { type: "boolean", description: "День подвижного круга" },
                    readings: { type: "array", items: { $ref: "#/components/schemas/Slot" } },
                },
            },
            Slot: {
                type: "object",
                description: "Место службы и что на нём читается",
                properties: {
                    slot: { type: "string", example: "song6" },
                    title: { type: "string", example: "По шестой песни" },
                    items: { type: "array", items: { $ref: "#/components/schemas/SlotItem" } },
                },
            },
            SlotItem: {
                type: "object",
                properties: {
                    cite: { type: ["string", "null"] },
                    description: { type: ["string", "null"] },
                    text: { oneOf: [{ $ref: "#/components/schemas/Text" }, { type: "null" }] },
                    pericope: { oneOf: [{ $ref: "#/components/schemas/Pericope" }, { type: "null" }] },
                },
            },
            CalendarDay: {
                type: "object",
                properties: {
                    date: { type: "string", format: "date", description: "Гражданская дата запроса" },
                    churchDate: { type: ["string", "null"], format: "date", description: "Она же по старому стилю" },
                    movable: {
                        type: ["object", "null"],
                        description: "Положение в подвижном круге с учётом отступки и преступки",
                        properties: {
                            week: { type: "integer" },
                            day: { type: "integer", description: "1 — понедельник, 7 — воскресенье" },
                            type: { type: "string", enum: ["Pascha", "Penticostarion", "first", "Triodion", "Fast"] },
                        },
                    },
                    memories: {
                        type: "object",
                        properties: {
                            primary: { oneOf: [{ $ref: "#/components/schemas/Memory" }, { type: "null" }] },
                            secondary: { type: "array", items: { $ref: "#/components/schemas/Memory" } },
                        },
                    },
                    day: { oneOf: [{ $ref: "#/components/schemas/Day" }, { type: "null" }] },
                },
            },
            Memory: {
                type: "object",
                properties: {
                    id: { type: ["string", "null"] },
                    name: { type: "string" },
                    sign: { type: ["string", "null"], description: "Знак Типикона" },
                },
            },
            Pericope: {
                type: "object",
                properties: {
                    id: { type: "string" },
                    source: { type: ["string", "null"], enum: ["gospel", "apostle", "paremia", null] },
                    bookSlug: { type: ["string", "null"] },
                    number: { type: ["integer", "null"] },
                    label: { type: ["string", "null"], example: "Мк. 11" },
                    ranges: { type: "array", items: { type: "object" } },
                    occasions: { type: "array", items: { type: "string" }, description: "Когда это зачало читается" },
                    verses: { type: "array", items: { $ref: "#/components/schemas/Verse" } },
                },
            },
            Sign: {
                type: "object",
                properties: {
                    id: { type: "string" },
                    month: { type: ["integer", "null"] },
                    date: { type: ["integer", "null"] },
                    name: { type: "string" },
                    sign: { type: ["string", "null"] },
                    isDefault: { type: "boolean" },
                },
            },
            Month: {
                type: "object",
                properties: { id: { type: "string" }, alias: { type: ["string", "null"] }, value: { type: ["integer", "null"] } },
            },
            MonthDetail: {
                allOf: [
                    { $ref: "#/components/schemas/Month" },
                    { type: "object", properties: { days: { type: "array", items: { type: "object" } } } },
                ],
            },
            Week: {
                type: "object",
                properties: {
                    id: { type: "string" },
                    alias: { type: ["string", "null"] },
                    label: { type: ["string", "null"] },
                    type: { type: ["string", "null"] },
                    value: { type: ["integer", "null"] },
                    triodion: { type: "boolean" },
                    penticostarion: { type: "boolean" },
                },
            },
            WeekDetail: {
                allOf: [
                    { $ref: "#/components/schemas/Week" },
                    { type: "object", properties: { days: { type: "array", items: { type: "object" } } } },
                ],
            },
            SaintTexts: {
                type: "object",
                properties: {
                    dneslovId: { type: "string" },
                    texts: { type: "array", items: { $ref: "#/components/schemas/Text" }, description: "Тексты памяти святого" },
                    mentions: { type: "array", items: { $ref: "#/components/schemas/Text" }, description: "Тексты, где он упоминается" },
                },
            },
            News: {
                type: "object",
                properties: {
                    id: { type: "string" },
                    alias: { type: "string", description: "Постоянный адрес: /news/{alias}" },
                    title: { type: "string" },
                    summary: { type: "string", description: "Короткое изложение; оно же уходит в RSS" },
                    body: { type: "string", description: "Текст в markdown" },
                    type: { type: "string", enum: ["update", "announcement"] },
                    version: { type: ["string", "null"], description: "Версия сайта или приложения, если новость про выпуск" },
                    publishedAt: { type: "string", format: "date-time" },
                    updatedAt: { type: "string", format: "date-time" },
                },
            },
            NewsList: collection("#/components/schemas/News"),
            TextList: collection("#/components/schemas/Text"),
            SnippetPart: {
                type: "object",
                description: "Кусок фрагмента; hit — попал ли он под запрос",
                properties: { text: { type: "string" }, hit: { type: "boolean" } },
            },
            Chant: {
                type: "object",
                description: "Песнопение книги на своём месте службы",
                properties: {
                    id: { type: "integer" },
                    snippet: { type: "array", items: { $ref: "#/components/schemas/SnippetPart" } },
                    language: {
                        type: ["string", "null"],
                        enum: [...LANGUAGES, null],
                        description: "Язык самой строки; корпус шестиязычен",
                    },
                    unit: { type: ["string", "null"], description: "Род: stichera, sedalen, troparion, irmos…" },
                    ode: { type: ["integer", "null"], description: "Песнь канона, если это канон" },
                    marker: { type: ["string", "null"], description: "Жанр напечатанного: богородичен, троичен, мученичен…" },
                    placement: { type: ["string", "null"], description: "Место в группе: slava, i-nyne, slava-i-nyne" },
                    memoryId: { type: ["string", "null"] },
                    memory: { type: ["string", "null"], description: "Память, которой это поётся" },
                    book: { type: ["string", "null"] },
                    month: { type: ["integer", "null"] },
                    day: { type: ["integer", "null"] },
                    service: { type: ["string", "null"] },
                    position: { type: ["string", "null"], description: "Место службы: «Стихиры на Господи воззвах» и т.п." },
                    tone: { type: ["integer", "null"] },
                    sign: { type: ["string", "null"] },
                    akathist: {
                        type: ["string", "null"],
                        description:
                            "У строфы акафиста нет ни книги, ни дня: её адрес — имя произведения "
                            + "и номер строфы",
                    },
                    stanza: { type: ["integer", "null"], description: "Номер строфы акафиста" },
                    stanzaKind: {
                        type: ["string", "null"], enum: ["prooimion", "stanza", null],
                        description:
                            "Проимий или строфа акростиха: у проимиев счёт свой, и номер их не "
                            + "различает",
                    },
                    sourceBook: {
                        type: ["string", "null"],
                        description: "Издание, откуда строка: одно место службы печатают несколько",
                    },
                },
            },
            ChantList: collection("#/components/schemas/Chant"),
            CanonFacets: {
                type: "object",
                description: "Чем можно сузить перечень. Значения — из самого корпуса, не списком в коде",
                properties: {
                    books: { type: "array", items: { type: "string" } },
                    tones: { type: "array", items: { type: "integer" } },
                    services: { type: "array", items: { type: "string" } },
                    roles: { type: "array", items: { type: "string" } },
                },
            },
            Canon: {
                type: "object",
                description: "Канон в перечне",
                properties: {
                    id: { type: "string" },
                    memory: { type: ["string", "null"], description: "Кому канон: метка памяти, под которой напечатан" },
                    memoryId: { type: ["string", "null"] },
                    book: { type: ["string", "null"] },
                    month: { type: ["integer", "null"] },
                    day: { type: ["integer", "null"] },
                    paschaOffset: { type: ["integer", "null"] },
                    weekday: { type: ["string", "null"] },
                    memoryTone: { type: ["integer", "null"], description: "Глас памяти у Октоиха — не то же, что глас канона" },
                    tone: { type: ["integer", "null"] },
                    creator: {
                        type: ["string", "null"],
                        description:
                            "Надписание, КАК НАПЕЧАТАНО книгой: «Творе́ние Ио́сифово. Гла́с 2.» "
                            + "Напечатанное есть свидетельство",
                    },
                    author: {
                        type: ["string", "null"],
                        description:
                            "Лицо, с которым надписание отождествлено, — если отождествлено. Это "
                            + "вывод из свидетельства, и он может быть неверен; где отождествления "
                            + "нет, остаётся одно надписание",
                    },
                    authorCentury: { type: ["string", "null"] },
                    authorMethod: { type: ["string", "null"], description: "Каким свидетелем: надписание, греческий подлинник, документ" },
                    acrostic: { type: ["string", "null"], description: "Краегранесие" },
                    service: { type: ["string", "null"] },
                    role: { type: ["string", "null"] },
                    language: {
                        type: ["string", "null"],
                        description:
                            "Язык издания. Без него английский канон в перечне неотличим от "
                            + "славянского: подписи у них одни и те же",
                    },
                    odes: { type: "integer", description: "Сколько песней" },
                    items: { type: "integer", description: "Сколько строк" },
                },
            },
            CanonList: collectionWithFacets("#/components/schemas/Canon", "#/components/schemas/CanonFacets"),
            Place: {
                type: "object",
                properties: {
                    id: { type: ["string", "null"] },
                    name: { type: ["string", "null"] },
                    alias: { type: ["string", "null"] },
                    description: { type: ["string", "null"] },
                    synonyms: {
                        type: "array", items: { type: "string" },
                        description: "Как ещё называется: по ним место и находят в тексте",
                    },
                    links: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                text: { type: ["string", "null"] },
                                url: { type: ["string", "null"] },
                            },
                        },
                    },
                    latitude: {
                        type: ["number", "null"],
                        description: "Может отсутствовать: не у всякого места есть точка",
                    },
                    longitude: { type: ["number", "null"] },
                },
            },
            AppVersion: {
                type: "object",
                properties: {
                    version: { type: "string", description: "Полный номер: «2.0.0»" },
                    major: { type: "integer" },
                    minor: { type: "integer" },
                    patch: { type: "integer" },
                    download: {
                        type: "string",
                        description: "Откуда скачать последний выпуск",
                    },
                    archive: {
                        type: "string",
                        description:
                            "Тот же выпуск под своим номером: download — копия последнего и "
                            + "версии в себе не несёт",
                    },
                },
            },
            CanonLine: {
                type: "object",
                properties: {
                    unit: { type: ["string", "null"], description: "irmos или troparion" },
                    text: { type: "string", description: "Пусто, когда стоит reference" },
                    borrowed: {
                        type: "boolean",
                        description:
                            "Текст взят по ссылке: книга печатает ирмос зачином, а полный лежит в "
                            + "Ирмологии. Показать его неподписанным — выдать отсылку за песнопение",
                    },
                    reference: {
                        type: ["string", "null"],
                        description:
                            "Ссылка, которую разрешить не удалось: греческий слой ссылается на "
                            + "Ирмологий, которого в корпусе нет. Текста в этой строке не будет — "
                            + "скажите об этом словами, а не печатайте опознаватель как песнопение",
                    },
                    marker: { type: ["string", "null"], description: "Богородичен, троичен, мученичен…" },
                    repeat: { type: "integer", description: "«Ирмо́с по два́жды» — указание книги" },
                },
            },
            CanonOde: {
                type: "object",
                properties: {
                    ode: {
                        type: "integer",
                        description:
                            "Номер песни, КАК В КНИГЕ. Нумерация не сплошная: второй песни нет ни "
                            + "у кого, кроме Великого канона",
                    },
                    irmos: { type: "array", items: { $ref: "#/components/schemas/CanonLine" } },
                    troparia: { type: "array", items: { $ref: "#/components/schemas/CanonLine" } },
                },
            },
            CanonDetail: {
                allOf: [
                    { $ref: "#/components/schemas/Canon" },
                    {
                        type: "object",
                        properties: {
                            odesList: { type: "array", items: { $ref: "#/components/schemas/CanonOde" } },
                        },
                    },
                ],
            },
            AkathistFacets: {
                type: "object",
                properties: {
                    subjectKinds: { type: "array", items: { type: "string" } },
                    statuses: { type: "array", items: { type: "string" } },
                },
            },
            Akathist: {
                type: "object",
                properties: {
                    id: { type: "string" },
                    title: { type: "string" },
                    subjectKind: {
                        type: ["string", "null"],
                        description:
                            "Кому: gospod, bogorodica, ikona, prazdnik, svyatoy, inoe. Не памяти и "
                            + "не святому одно вместо другого: акафист Богородице пред иконой "
                            + "обращён к иконе. `inoe` — то, что стоит в источнике: Кресту, "
                            + "Ангелам, ко Причащению, о упокоении, покаянный",
                    },
                    status: {
                        type: ["string", "null"], enum: ["ustavny", "odobrenny", "chastny", null],
                        description:
                            "`ustavny` — положен уставом; таких один. Прочие собраны ради корпуса и "
                            + "в сборку служб не идут",
                    },
                    dneslovId: { type: ["string", "null"] },
                    memoryId: { type: ["string", "null"] },
                    memory: { type: ["string", "null"], description: "Служба, в которой напечатан. Есть только у Великого" },
                    stanzas: { type: "integer" },
                    prooimia: { type: "integer", description: "Проимиев бывает несколько, и счёт у них свой" },
                },
            },
            AkathistList: collectionWithFacets("#/components/schemas/Akathist", "#/components/schemas/AkathistFacets"),
            AkathistStanza: {
                type: "object",
                properties: {
                    index: { type: "integer", description: "Порядок чтения; он же порядок показа" },
                    kind: {
                        type: ["string", "null"], enum: ["prooimion", "stanza", null],
                        description:
                            "Различает проимий и строфу акростиха. Именно это поле, а не номер: "
                            + "акростишный «кондак 2» и второй проимий несут одно число",
                    },
                    unit: { type: ["string", "null"], description: "kontakion или ikos" },
                    stanza: { type: ["integer", "null"] },
                    letter: {
                        type: ["string", "null"],
                        description:
                            "Буква краегранесия. У Великого акафиста двадцать четыре строфы идут по "
                            + "греческому алфавиту, и недостающая буква значит потерянную строфу",
                    },
                    text: { type: "string" },
                },
            },
            AkathistDetail: {
                allOf: [
                    { $ref: "#/components/schemas/Akathist" },
                    {
                        type: "object",
                        properties: {
                            refrainIkos: {
                                type: ["string", "null"],
                                description: "Им кончается каждый икос; по рефрену акафист и опознают",
                            },
                            refrainKontakion: { type: ["string", "null"] },
                            sourceBook: { type: ["string", "null"] },
                            sourceUrl: { type: ["string", "null"] },
                            stanzasList: { type: "array", items: { $ref: "#/components/schemas/AkathistStanza" } },
                            prayers: {
                                type: "array",
                                items: { $ref: "#/components/schemas/Prayer" },
                                description: "Молитвы, что печатаются при этом акафисте",
                            },
                        },
                    },
                ],
            },
            PrayerFacets: {
                type: "object",
                properties: { kinds: { type: "array", items: { type: "string" } } },
            },
            Prayer: {
                type: "object",
                properties: {
                    id: { type: "string" },
                    title: { type: ["string", "null"], description: "Подписаны почти все просто «Моли́тва»" },
                    kind: { type: ["string", "null"], enum: ["memory", "akathist", "canon", null] },
                    owner: { type: ["string", "null"], description: "При ком напечатана" },
                    ownerId: { type: ["string", "null"] },
                    seq: { type: "integer" },
                    incipit: { type: ["string", "null"], description: "Начало текста: тем и различаются две молитвы одного акафиста" },
                },
            },
            PrayerList: collectionWithFacets("#/components/schemas/Prayer", "#/components/schemas/PrayerFacets"),
            PrayerDetail: {
                allOf: [
                    { $ref: "#/components/schemas/Prayer" },
                    {
                        type: "object",
                        properties: {
                            text: { type: "string" },
                            language: { type: ["string", "null"] },
                            sourceBook: { type: ["string", "null"] },
                            sourceUrl: { type: ["string", "null"] },
                            siblings: {
                                type: "array",
                                description: "Что напечатано здесь же — при том же акафисте или той же памяти",
                                items: {
                                    type: "object",
                                    properties: {
                                        id: { type: "string" },
                                        title: { type: ["string", "null"] },
                                        seq: { type: "integer" },
                                    },
                                },
                            },
                        },
                    },
                ],
            },
            ChantDetail: {
                type: "object",
                description: "Песнопение целиком",
                properties: {
                    id: { type: "integer" },
                    text: { type: "string", description: "Текст, как напечатан: с ударениями и разметкой строк" },
                    borrowed: {
                        type: "boolean",
                        description:
                            "Своего текста у строки нет — он взят по ссылке. Книги печатают ирмос "
                            + "зачином («Ирмо́с: Христо́с ражда́ется:»), а полный текст лежит в "
                            + "Ирмологии или в соседнем каноне. Показать подставленный текст "
                            + "неподписанным значило бы выдать его за напечатанный здесь.",
                    },
                    textItemId: {
                        type: ["integer", "null"],
                        description:
                            "Чья это строка: своя или та, откуда текст взят. Нужно всему, что "
                            + "считается по смещениям в тексте — они посчитаны по строке со своим "
                            + "текстом. `null` — текст пришёл из словаря формул.",
                    },
                    language: { type: ["string", "null"], enum: [...LANGUAGES, null] },
                    unit: { type: ["string", "null"] },
                    marker: { type: ["string", "null"] },
                    markerAlt: { type: ["string", "null"] },
                    placement: { type: ["string", "null"] },
                    repeat: { type: "integer", description: "Сколько раз поётся: указание книги" },
                    ode: { type: ["integer", "null"] },
                    stanza: { type: ["integer", "null"] },
                    stanzaKind: { type: ["string", "null"], enum: ["prooimion", "stanza", null] },
                    tone: { type: ["integer", "null"] },
                    podoben: {
                        type: ["string", "null"],
                        description: "Подобен, как напечатала книга: по нему напев выбирается прежде гласа",
                    },
                    service: { type: ["string", "null"] },
                    position: { type: ["string", "null"] },
                    groupLabel: { type: ["string", "null"] },
                    memoryId: { type: ["string", "null"] },
                    memory: { type: ["string", "null"] },
                    book: { type: ["string", "null"] },
                    month: { type: ["integer", "null"] },
                    day: { type: ["integer", "null"] },
                    paschaOffset: { type: ["integer", "null"] },
                    weekday: { type: ["string", "null"] },
                    memoryTone: { type: ["integer", "null"] },
                    sign: { type: ["string", "null"] },
                    akathist: { type: ["string", "null"] },
                    canonId: { type: ["string", "null"] },
                    sourceBook: { type: ["string", "null"], description: "Издание, откуда строка" },
                },
            },
            Incipit: {
                type: "object",
                description: "Зачин в указателе",
                properties: {
                    incipit: { type: "string", description: "Ключ: шесть первых слов без ударений, строчными" },
                    language: { type: "string" },
                    uses: { type: "integer", description: "Сколько раз встречается в корпусе. У 91,6 % зачинов — один" },
                    sampleId: { type: "integer", description: "Вхождение, по которому показан текст; его же можно взять в /api/v2/chants" },
                    text: { type: "string", description: "Как напечатано, с ударениями" },
                    unit: { type: ["string", "null"] },
                    book: { type: ["string", "null"] },
                    memory: { type: ["string", "null"] },
                    akathist: { type: ["string", "null"] },
                },
            },
            IncipitWitness: {
                type: "object",
                description: "Одно вхождение зачина: где именно в книге оно стоит",
                properties: {
                    id: { type: "integer", description: "Строка корпуса, она же /api/v2/chants" },
                    language: { type: "string" },
                    unit: { type: ["string", "null"] },
                    ode: { type: ["integer", "null"] },
                    stanza: { type: ["integer", "null"] },
                    stanzaKind: { type: ["string", "null"] },
                    marker: { type: ["string", "null"] },
                    placement: { type: ["string", "null"] },
                    tone: { type: ["integer", "null"] },
                    service: { type: ["string", "null"] },
                    position: { type: ["string", "null"] },
                    memoryId: { type: ["string", "null"] },
                    memory: { type: ["string", "null"] },
                    book: { type: ["string", "null"] },
                    month: { type: ["integer", "null"] },
                    day: { type: ["integer", "null"] },
                    paschaOffset: { type: ["integer", "null"] },
                    weekday: { type: ["string", "null"] },
                    akathist: { type: ["string", "null"] },
                    canonId: { type: ["string", "null"] },
                    sourceBook: { type: ["string", "null"] },
                },
            },
            IncipitCorrespondence: {
                type: "object",
                description: "Соответствие на другом языке вместе с основанием связи",
                properties: {
                    id: { type: "integer" },
                    language: { type: "string" },
                    text: { type: "string" },
                    incipit: { type: ["string", "null"] },
                    method: { type: "string", enum: ["edition", "structure", "manual"], description: "edition — общий ключ издателя; structure — совпавшее место службы" },
                    confidence: { type: "string", enum: ["certain", "candidate"] },
                    evidence: { type: ["string", "null"], description: "На чём стоит связь, словами" },
                },
            },
            IncipitDetail: {
                type: "object",
                description: "Зачин целиком: вхождения и соответствия",
                properties: {
                    incipit: { type: "string" },
                    language: { type: "string" },
                    uses: { type: "integer" },
                    text: { type: "string" },
                    borrowed: { type: "boolean", description: "Текста своего у строки нет — взят по ссылке из Ирмология или соседнего канона" },
                    witnesses: { type: "array", items: { $ref: "#/components/schemas/IncipitWitness" } },
                    correspondences: {
                        type: "object",
                        properties: {
                            declared: { type: "array", items: { $ref: "#/components/schemas/IncipitCorrespondence" }, description: "Заявлено изданием" },
                            supposed: { type: "array", items: { $ref: "#/components/schemas/IncipitCorrespondence" }, description: "Догадка по месту службы; бывает ложной" },
                        },
                    },
                },
            },
            IncipitList: collection("#/components/schemas/Incipit"),
            SearchList: collection("#/components/schemas/SearchResult"),
            BookList: collection("#/components/schemas/Book"),
            MonthList: collection("#/components/schemas/Month"),
            WeekList: collection("#/components/schemas/Week"),
            PericopeList: collection("#/components/schemas/Pericope"),
            SignList: collection("#/components/schemas/Sign"),
        },
    },
});

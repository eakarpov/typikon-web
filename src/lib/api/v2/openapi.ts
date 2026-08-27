import { LICENSE_ID, LICENSE_URL } from "@/lib/api/v2/http";
import { DEFAULT_LIMIT, MAX_LIMIT } from "@/lib/api/v2/params";
import { ANONYMOUS_ALLOWANCE, TIERS } from "@/lib/api/v2/tokens";

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

export const openapi = () => ({
    openapi: "3.1.0",
    info: {
        title: "Уставные чтения — API",
        version: "2.0.0",
        description:
            "Церковнославянские уставные чтения по Типикону: тексты, книги, привязка к дням " +
            "церковного года, зачала и знаки месяцеслова.\n\n" +
            "Корпус доступен по лицензии CC BY 4.0 — пользуйтесь свободно, указывая источник. " +
            "Оригиналы памятников находятся в общественном достоянии. Сканы, переводы и данные " +
            "святцев принадлежат их владельцам.\n\n" +
            `Доступ отмерен. Без ключа — ${ANONYMOUS_ALLOWANCE.limit} запросов в час с адреса и без ` +
            "поиска: этого хватает попробовать. С ключом — " +
            `${TIERS.free.limit} запросов в минуту и ${TIERS.free.perDay} в сутки, включая поиск. ` +
            "Ключ заводится в профиле на typikon.su и передаётся заголовком Authorization: Bearer. " +
            "Остаток виден в заголовках X-RateLimit-Remaining и X-Quota-Remaining.",
        license: { name: LICENSE_ID, url: LICENSE_URL },
        contact: { url: "https://typikon.su/contact" },
    },
    servers: [{ url: "https://typikon.su", description: "Основной сервер" }],
    // Ключ не обязателен: без него ручки тоже отвечают, только скупее и без поиска.
    // Поэтому security на уровне документа, а не в каждой операции.
    security: [{ apiKey: [] }, {}],
    tags: [
        { name: "Календарь", description: "Что читается в конкретный день" },
        { name: "Тексты", description: "Корпус текстов и книги" },
        { name: "Справочники", description: "Зачала, знаки, месяцы, седмицы, святые" },
        { name: "Песнопения", description: "Стихиры, тропари и каноны книг по местам службы" },
        { name: "Новости", description: "Что нового в корпусе и на сайте" },
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
                    ...pageParams,
                ],
                responses: {
                    "200": ok("#/components/schemas/ChantList"),
                    "400": errorResponse("Запрос слишком короткий"),
                    "500": errorResponse("Корпус песнопений на сервере недоступен"),
                },
            },
        },
        "/api/v2/days/{alias}": {
            get: {
                tags: ["Календарь"],
                summary: "День по постоянному адресу",
                parameters: [{ name: "alias", in: "path", required: true, schema: { type: "string" }, example: "pascha" }],
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
                summary: "Седмицы Триоди",
                parameters: [{ name: "cycle", in: "query", schema: { type: "string", enum: ["triodion", "penticostarion"] } }],
                responses: { "200": ok("#/components/schemas/WeekList") },
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
        "/api/v2/saints/{id}": {
            get: {
                tags: ["Справочники"],
                summary: "Тексты, связанные со святым",
                description: "Идентификатор — из святцев dneslov.org. Сведения о самом святом берите там же.",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" }, example: "3030" }],
                responses: { "200": ok("#/components/schemas/SaintTexts"), "404": errorResponse("Текстов не найдено") },
            },
        },
    },
    components: {
        securitySchemes: {
            apiKey: {
                type: "http",
                scheme: "bearer",
                description:
                    "Ключ доступа, выпускается в профиле на typikon.su. Даёт больший лимит и " +
                    "открывает поиск. Запасной вид — заголовок X-Api-Key с тем же значением.",
            },
        },
        schemas: {
            Error: {
                type: "object",
                properties: {
                    error: {
                        type: "object",
                        properties: {
                            code: { type: "string", enum: ["not_found", "bad_request", "rate_limited", "internal"] },
                            message: { type: "string" },
                        },
                    },
                },
            },
            Service: { type: "object", description: "Описание сервиса, счётчики и условия использования" },
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
                    contentType: { type: ["string", "null"], description: "verses — текст из стихов (библейская книга)" },
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
                            verses: { type: "array", items: { $ref: "#/components/schemas/Verse" } },
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
                },
            },
            ChantList: collection("#/components/schemas/Chant"),
            SearchList: collection("#/components/schemas/SearchResult"),
            BookList: collection("#/components/schemas/Book"),
            MonthList: collection("#/components/schemas/Month"),
            WeekList: collection("#/components/schemas/Week"),
            PericopeList: collection("#/components/schemas/Pericope"),
            SignList: collection("#/components/schemas/Sign"),
        },
    },
});

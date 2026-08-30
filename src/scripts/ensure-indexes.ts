// Заводит индексы Mongo, которых требуют реальные запросы приложения.
//
// Зачем: до этого скрипта в базе не было ни одного индекса, кроме текстового по
// texts.name — то есть каждое открытие чтения, дня или книги шло полным перебором
// коллекции. Хуже всего доставалось verses (73 тысячи документов, перебор на каждую
// страницу библейского текста). Индексы, созданные руками в консоли, не переживают
// `mongorestore --drop`, поэтому они должны быть в репозитории и накатываться скриптом.
//
// Скрипт идемпотентный: createIndex с тем же ключом ничего не делает повторно,
// так что его безопасно гонять после каждого восстановления базы.
//
// Запуск:
//   npx tsx src/scripts/ensure-indexes.ts           # план, ничего не создаёт
//   npx tsx src/scripts/ensure-indexes.ts --apply   # создать недостающие
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";

const APPLY = process.argv.includes("--apply");

type Spec = {
    db: string;
    collection: string;
    key: Record<string, 1 | -1>;
    options?: Record<string, any>;
    why: string;
};

// Уникальность alias только для непустых строк: у 612 текстов alias вообще нет,
// ещё у 8 он пустой, и такие документы уникальности мешать не должны.
const NON_EMPTY_ALIAS = { partialFilterExpression: { alias: { $gt: "" } }, unique: true };

const SPECS: Spec[] = [
    // --- typikon: контент
    { db: "typikon", collection: "texts", key: { alias: 1 }, options: NON_EMPTY_ALIAS,
      why: "/reading/{alias} — самый частый запрос на сайте; уникальность закрывает коллизии адресов" },
    { db: "typikon", collection: "texts", key: { dneslovId: 1 },
      why: "/saints/{id} — тексты памяти святого" },
    { db: "typikon", collection: "texts", key: { mentionIds: 1 },
      why: "/saints/{id} — тексты с упоминанием (getMentions)" },
    { db: "typikon", collection: "texts", key: { bookId: 1 },
      why: "страница книги в библиотеке" },
    { db: "typikon", collection: "texts", key: { readiness: 1, textingPriority: 1 },
      why: "/texting — очередь на отекстовку" },
    { db: "typikon", collection: "texts", key: { updatedAt: -1 },
      why: "последние обновления на главной и lastmod в карте сайта" },

    // --- typikon: Библия (@/lib/bible/schema)
    //
    // Те же 73 тысячи стихов, но спрашивают их иначе. Зачало ищет отрезок канона
    // внутри одного издания — это первый ключ. Параллельный вид ищет один стих
    // сразу во всех изданиях — это второй. Третий держит уникальность: два стиха
    // с одним номером в одной книге издания — это сбой переноса, и упасть на записи
    // дешевле, чем показывать читателю двоящийся стих.
    { db: "typikon", collection: "bible_verses", key: { editionId: 1, canonId: 1, canonSort: 1 },
      why: "зачало и глава: отрезок канонической нумерации внутри издания" },
    { db: "typikon", collection: "bible_verses", key: { canonRef: 1, editionId: 1 },
      why: "параллельный вид: один стих канона сразу во всех изданиях" },
    { db: "typikon", collection: "bible_verses", key: { editionId: 1, bookId: 1, chapter: 1, verse: 1 },
      options: { unique: true },
      why: "родная нумерация издания: показ книги и защита от двойного переноса" },

    { db: "typikon", collection: "bible_books", key: { editionId: 1, slug: 1 }, options: { unique: true },
      why: "книга издания по её слугу; уникальность — та же защита от двойного переноса" },
    { db: "typikon", collection: "bible_books", key: { editionId: 1, canonId: 1 },
      why: "какие книги издания легли в книгу канона (у румынского Даниила их четыре)" },
    { db: "typikon", collection: "bible_books", key: { alias: 1 }, options: NON_EMPTY_ALIAS,
      why: "постоянный редирект со старых адресов /reading/biblia-*" },

    { db: "typikon", collection: "bible_editions", key: { code: 1 }, options: { unique: true },
      why: "издание по коду — основной способ его найти" },
    { db: "typikon", collection: "bible_editions", key: { langCode: 1, isDefaultForLang: -1 },
      why: "издание по умолчанию для выбранного языка (cookie bibleLang)" },

    { db: "typikon", collection: "days", key: { alias: 1 }, options: NON_EMPTY_ALIAS,
      why: "/calendar/{alias}, /triodion/{alias}, /penticostarion/{alias}" },
    { db: "typikon", collection: "days", key: { weekId: 1 },
      why: "дни недели триоди" },
    { db: "typikon", collection: "days", key: { monthIndex: 1 },
      why: "список дней месяца" },

    { db: "typikon", collection: "months", key: { alias: 1 }, options: NON_EMPTY_ALIAS,
      why: "/months/{alias}" },
    { db: "typikon", collection: "weeks", key: { alias: 1 },
      why: "недели триоди по алиасу" },
    { db: "typikon", collection: "weeks", key: { triodion: 1, penticostration: 1 },
      why: "разделы Постной и Цветной триоди" },

    { db: "typikon", collection: "books", key: { public: 1, name: 1 },
      why: "список библиотеки: фильтр по public и сортировка по названию" },

    { db: "typikon", collection: "pericopes", key: { source: 1 },
      why: "зачала по источнику (Евангелие / Апостол / паремия)" },
    { db: "typikon", collection: "pericopes", key: { bookSlug: 1, number: 1 },
      why: "зачало по книге и номеру" },

    { db: "typikon", collection: "signs", key: { month: 1, date: 1, order: 1 },
      why: "знаки Типикона на день; тот же ключ обслуживает сортировку списка" },

    { db: "typikon", collection: "channelPosts", key: { status: 1, scheduledAt: 1 },
      why: "публикатор выбирает готовые посты с наступившим временем" },

    // --- typikon-news: новости об обновлениях
    { db: "typikon-news", collection: "posts", key: { alias: 1 }, options: { unique: true },
      why: "/news/{alias} и /api/v2/news/{alias}; уникальность разводит новости с похожими заголовками" },
    { db: "typikon-news", collection: "posts", key: { status: 1, publishedAt: -1 },
      why: "лента, RSS и точка «новое» в меню — все три берут последние выложенные" },

    // --- typikon-users: ключи публичного API
    { db: "typikon-users", collection: "apiTokens", key: { hash: 1 }, options: { unique: true },
      why: "проверка ключа на каждом запросе к /api/v2; уникальность — страховка от двойного выпуска" },
    { db: "typikon-users", collection: "apiTokens", key: { userId: 1, createdAt: -1 },
      why: "список своих ключей в профиле" },
    { db: "typikon-users", collection: "apiTokenUsage", key: { tokenId: 1, day: 1 }, options: { unique: true },
      why: "суточный расход ключа: читается при первом запросе за сутки и переписывается на месте" },

    { db: "typikon", collection: "mentionCandidates", key: { textId: 1, dneslovId: 1 }, options: { unique: true },
      why: "кандидат на упоминание — один на пару текст/святой" },
    { db: "typikon", collection: "mentionCandidates", key: { status: 1, dneslovId: 1 },
      why: "экран ревью: группировка по святому среди неразобранных" },

    // --- typikon-users: вход и вклад пользователей
    { db: "typikon-users", collection: "users", key: { "auth.google.userId": 1 }, options: { sparse: true },
      why: "вход через Google" },
    { db: "typikon-users", collection: "users", key: { "auth.vk.userId": 1 }, options: { sparse: true },
      why: "вход через VK" },
    { db: "typikon-users", collection: "users", key: { "auth.telegram.userId": 1 }, options: { sparse: true },
      why: "вход через Telegram" },
    { db: "typikon-users", collection: "sessions", key: { expiresAt: 1 },
      why: "чистка протухших сессий (TTL сознательно не ставим — это удаление данных, решать вам)" },
    { db: "typikon-users", collection: "textingProposals", key: { userId: 1, textId: 1, status: 1 },
      why: "проверка «пользователь уже предложил отекстовку этого текста»" },
    { db: "typikon-users", collection: "textingProposals", key: { status: 1 },
      why: "очередь предложений в админке и счётчик принятых" },
    { db: "typikon-users", collection: "userNotes", key: { userId: 1, textId: 1 },
      why: "личные заметки пользователя к тексту" },
    { db: "typikon-users", collection: "favourites", key: { userId: 1, textId: 1 }, options: { unique: true },
      why: "избранное: уникальность держит повторное добавление идемпотентным, она же обслуживает удаление по паре" },
    { db: "typikon-users", collection: "favourites", key: { userId: 1, createdAt: -1 },
      why: "выдача избранного списком, новые сверху" },

    // --- typikon-meta
    { db: "typikon-meta", collection: "logs", key: { ipHash: 1, url: 1 },
      why: "счётчик просмотров ищет запись по паре ipHash+url на каждый просмотр страницы" },
    { db: "typikon-meta", collection: "logs", key: { kind: 1 },
      why: "метрика отделяет подробные записи от помесячных итогов" },
];

const keyToString = (key: Record<string, number>) =>
    Object.entries(key).map(([k, v]) => `${k}:${v}`).join(", ");

const sameKey = (a: Record<string, any>, b: Record<string, any>) =>
    JSON.stringify(Object.entries(a)) === JSON.stringify(Object.entries(b));

async function main() {
    const client = await clientPromise;

    let existing = 0;
    let created = 0;
    let failed = 0;
    const missing: Spec[] = [];

    for (const spec of SPECS) {
        const collection = client.db(spec.db).collection(spec.collection);

        let current: any[] = [];
        try {
            current = await collection.indexes();
        } catch {
            // коллекции может не быть вовсе — createIndex её заведёт
            current = [];
        }

        const already = current.some((i) => sameKey(i.key, spec.key));
        const label = `${spec.db}.${spec.collection} { ${keyToString(spec.key)} }`;

        if (already) {
            existing++;
            console.log(`  есть      ${label}`);
            continue;
        }

        missing.push(spec);
        console.log(`  НЕТ       ${label}`);
        console.log(`            ${spec.why}`);

        if (!APPLY) continue;

        try {
            const started = Date.now();
            await collection.createIndex(spec.key as any, spec.options ?? {});
            console.log(`            создан за ${Date.now() - started} мс`);
            created++;
        } catch (e: any) {
            failed++;
            // Уникальный индекс не встанет, пока в коллекции есть дубликаты —
            // это не повод падать, это повод сказать, чем чинить.
            if (e?.code === 11000 || /duplicate key/i.test(e?.message ?? "")) {
                console.log(`            НЕ СОЗДАН: в коллекции есть дубликаты.`);
                if (spec.key.alias) {
                    console.log(`            Разведите их: npx tsx src/scripts/fix-duplicate-aliases.ts --apply`);
                } else {
                    console.log(`            ${e.message}`);
                }
            } else {
                console.log(`            НЕ СОЗДАН: ${e?.message ?? e}`);
            }
        }
    }

    console.log(`\n=== Итого ===`);
    console.log(`Уже было: ${existing}, не хватает: ${missing.length}`);
    if (APPLY) {
        console.log(`Создано: ${created}${failed ? `, не удалось: ${failed}` : ""}`);
    } else if (missing.length) {
        console.log(`Ничего не создано. Для создания: --apply`);
    }
    process.exit(failed ? 1 : 0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});

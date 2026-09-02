// Что проект отдаёт наружу выгрузкой и на каких условиях.
//
// Корпус под CC BY 4.0, но взять его целиком до сих пор было неоткуда: постранично
// мы просим не ходить (см. robots.ts), а публичный API отмерен тридцатью запросами в
// минуту — три тысячи текстов и сто пятьдесят тысяч стихов так забираются сутками.
// Выгрузка закрывает это: один архив, честные условия, контрольные суммы.
//
// ГЛАВНОЕ ЗДЕСЬ — НЕ ФОРМАТ, А РАЗБОР ПО ПРАВАМ. В базе рядом лежит наше, чужое и
// наше-под-чужой-лицензией, и одним куском это выложить нельзя: слои описаны в
// LICENSE-CORPUS.md, и здесь они выражены кодом. Поэтому каждая коллекция базы
// обязана быть либо в каком-то слое, либо в списке исключённых с причиной —
// сборка падает, если появилась коллекция, о которой никто ничего не сказал.
// Иначе первая же новая таблица уехала бы наружу молча.

export interface DumpLicense {
    id: string;
    name: string;
    url: string;
    /**
     * Файл с полным текстом лицензии в каталоге licenses/. Нужен там, где ссылки
     * мало: GPL-3.0 требует передавать копию лицензии вместе с работой (§4).
     */
    file?: string;
}

export interface DumpCollection {
    /** Коллекция Mongo. У производных выгрузок — null, их собирает сам скрипт. */
    source: string | null;
    /** Имя файла без расширения: <file>.jsonl.gz */
    file: string;
    title: string;
    /** Поля, которые наружу не идут: поле -> почему. Причина уходит в манифест. */
    drop?: Record<string, string>;
    /** Издание Библии, которым ограничена выгрузка (код из bible_editions). */
    edition?: string;
    /** Половина Библии: у греческого издания у них разное происхождение. */
    testament?: "ot" | "nt";
    /**
     * Своя лицензия на ОТДЕЛЬНЫЙ файл, когда она не та, что у слоя. Заведено ради
     * греческого Ветхого Завета: оцифровка чужая и под GPL-3.0, а всё остальное в
     * слое — наше под CC BY. Городить ради одного файла отдельный слой значило бы
     * прятать различие в устройстве каталогов вместо того, чтобы его назвать.
     */
    license?: DumpLicense;
    attribution?: string;
    note?: string;
}

/** Чего в слое НЕТ и где это взять самому. */
export interface DumpPointer {
    what: string;
    why: string;
    where: string;
}

export interface DumpLayer {
    /** Каталог внутри выгрузки. */
    id: string;
    title: string;
    license: DumpLicense;
    /** Как на слой ссылаться. */
    attribution: string;
    /** Почему условия именно такие. Уходит в README слоя и в манифест. */
    rationale: string;
    collections: DumpCollection[];
    /**
     * Чего в слое нет и где это взять. Не отговорка, а работа за читателя: он всё
     * равно пойдёт искать, и лучше дать ему адрес, чем оставить с пустым местом.
     */
    pointers?: DumpPointer[];
}

const CC_BY = {
    id: "CC-BY-4.0",
    name: "Creative Commons Attribution 4.0 International",
    url: "https://creativecommons.org/licenses/by/4.0/",
};

const GPL3 = {
    id: "GPL-3.0",
    name: "GNU General Public License v3.0",
    url: "https://www.gnu.org/licenses/gpl-3.0.html",
    file: "GPL-3.0.txt",
};

const PUBLIC_DOMAIN = {
    id: "PD",
    name: "Общественное достояние (Public Domain Mark 1.0)",
    url: "https://creativecommons.org/publicdomain/mark/1.0/",
};

const ODBL = {
    id: "ODbL-1.0",
    name: "Open Database License 1.0",
    url: "https://opendatacommons.org/licenses/odbl/1-0/",
};

export const CITATION = "Корпус «Уставные чтения» (typikon.su), CC BY 4.0";

export const LAYERS: DumpLayer[] = [
    {
        id: "corpus",
        title: "Корпус уставных чтений",
        license: CC_BY,
        attribution: CITATION,
        rationale:
            "Наборный текст памятников, ударения, разбиение, привязка чтений к дням и "
            + "слотам службы, разметка зачал и упоминаний — работа проекта. Сами памятники "
            + "(Пролог, Златоустник, Маргарит, Лествица и прочие) в общественном достоянии "
            + "по возрасту: на них не претендует никто, включая нас.",
        collections: [
            {
                source: "texts",
                file: "texts",
                title: "Тексты корпуса",
                drop: {
                    adminInfo: "служебные пометки набора, читателю снаружи не нужны",
                    fileId: "внутренняя ссылка на файл нашего хранилища",
                    searchContent: "производное от content, пересчитывается нормализацией",
                    searchName: "производное от name, пересчитывается нормализацией",
                },
            },
            { source: "books", file: "books", title: "Книги собрания" },
            { source: "months", file: "months", title: "Месяцы неподвижного круга" },
            { source: "days", file: "days", title: "Дни с расписанными чтениями" },
            { source: "weeks", file: "weeks", title: "Седмицы подвижного круга" },
            { source: "signs", file: "signs", title: "Знаки месяцеслова" },
            { source: "pericopes", file: "pericopes", title: "Зачала" },
            {
                source: "sources",
                file: "sources",
                title: "Описания рукописей и изданий",
                note: "Ссылки на сканы РГБ, НЭБ и lib-fond — сами сканы принадлежат хранилищам.",
            },
            { source: "places", file: "places", title: "Места" },
            { source: "memories", file: "memories", title: "Памяти святцев" },
            { source: "memory_saint_links", file: "memory-saint-links", title: "Связи памятей со святыми" },
            { source: "akathist_saint_links", file: "akathist-saint-links", title: "Связи акафистов со святыми" },
            {
                source: null,
                file: "accents",
                title: "Словарь ударений по корпусу",
                note:
                    "Основа -> где стоит ударение и сколько раз так написано. Выводится из "
                    + "текстов этого же слоя, поэтому отдаётся вместе с ними: два миллиона "
                    + "ударных словоформ, размеченных вручную за годы набора. Только по "
                    + "нашему корпусу — словарь церковнославянского, которым дополнен "
                    + "публичный /api/v2/accents, взят со стороны и сюда не входит.",
            },
            {
                source: "dedications",
                file: "dedications",
                title: "Словарь посвящений храмов",
                note: "Наш разбор имён храмов: чему посвящён престол. Им размечен слой temples.",
            },
            {
                source: "saints",
                file: "saints",
                title: "Каталог святых",
                drop: {
                    imageUrl: "изображение со стороны dneslov.org, условия на него не заявлены",
                    roundelUrl: "то же",
                    externals: "ссылки на чужие карточки, перенесены как есть",
                },
                note:
                    "Наше здесь — сведение, отождествление, имена и связи. Поля, перенесённые "
                    + "из святцев dneslov.org, сняты: их владелец условий нигде не объявил.",
            },
        ],
    },
    {
        id: "bible",
        title: "Библия: издания, книги и согласование нумераций",
        license: CC_BY,
        attribution: CITATION,
        rationale:
            "Наружу идёт то, что сделано здесь. Согласование нумераций — главное: у стиха "
            + "две пары чисел, родная (как напечатано в издании) и каноническая (приведённая "
            + "правилами к Елизаветинской Библии), и таблица их соответствия по пяти изданиям "
            + "выведена в проекте. Она отдаётся ЦЕЛИКОМ и без текста стиха, поэтому её можно "
            + "приложить к своей копии любого из этих изданий.\n\n"
            + "Текст стихов отдаётся там, где это позволено. Румынскую кириллицу 1688 и "
            + "китайский Новый Завет 1910 набирали мы — они под лицензией слоя. Греческий "
            + "Ветхий Завет (Свит) взят готовой оцифровкой под GPL-3.0 и отдаётся ПОД НЕЙ ЖЕ, "
            + "отдельным файлом со своей лицензией: пересдать чужую работу на своих условиях "
            + "мы не вправе, но и прятать её незачем — правообладатель распространение "
            + "разрешил, только на своих условиях.\n\n"
            + "Греческий Новый Завет — общественное достояние: Патриаршее издание 1904/1912 "
            + "взято у ebible.org, который отдаёт его без притязаний.\n\n"
            + "Церковнославянский и латинский остаются вне выгрузки: их оцифровки чужие и "
            + "разрешения на распространение не дают. Где взять их самому — сказано ниже.",
        collections: [
            {
                source: "bible_editions",
                file: "bible-editions",
                title: "Издания Библии",
                note: "С правилами согласования (mapping) и ссылкой на источник оцифровки.",
            },
            { source: "bible_books", file: "bible-books", title: "Книги изданий с привязкой к канону" },
            {
                source: null,
                file: "bible-concordance",
                title: "Согласование нумераций по всем пяти изданиям",
                note:
                    "Стих без текста: издание, книга, глава и стих как напечатано — и "
                    + "канонический адрес, куда это легло.",
            },
            {
                source: "bible_verses",
                file: "bible-verses-ro-1688",
                edition: "ro-1688",
                title: "Библия на румынской кириллице, 1688 — текст стихов",
                note: "Оцифровка выполнена в проекте по сканам издания.",
            },
            {
                source: "bible_verses",
                file: "bible-verses-zh-1910",
                edition: "zh-1910",
                title: "Китайский Новый Завет, Пекин 1910 — текст стихов",
                note: "Разбор печатного издания выполнен в проекте.",
            },
            {
                source: "bible_verses",
                file: "bible-verses-grc-nt",
                edition: "grc-lxx-pat",
                testament: "nt",
                title: "Патриаршее издание 1904/1912 — текст стихов Нового Завета",
                license: PUBLIC_DOMAIN,
                attribution:
                    "Текст: Η Καινή Διαθήκη, 1904 Patriarchal Greek New Testament, "
                    + "ebible.org/find/details.php?id=grcbyz — общественное достояние. "
                    + "Разбор на книги и согласование нумераций — проект «Уставные чтения» "
                    + "(typikon.su), CC BY 4.0",
                note:
                    "Общественное достояние, а не лицензия слоя: требовать указания "
                    + "источника на текст, который свободен от притязаний, мы не вправе. "
                    + "Наша работа над ним — разбор и согласование — под CC BY 4.0.",
            },
            {
                source: "bible_verses",
                file: "bible-verses-grc-ot",
                edition: "grc-lxx-pat",
                testament: "ot",
                title: "Септуагинта (Свит, Кембридж 1909–1930) — текст стихов",
                license: GPL3,
                attribution:
                    "Оцифровка: LXX-Swete-1930 (github.com/eliranwong/LXX-Swete-1930), GPL-3.0. "
                    + "Разбор на книги и согласование нумераций — проект «Уставные чтения» "
                    + "(typikon.su), CC BY 4.0",
                note:
                    "ТОЛЬКО этот файл идёт под GPL-3.0, а не весь слой: сам текст — чужая "
                    + "оцифровка, полный текст лицензии лежит рядом в GPL-3.0.txt. Издание "
                    + "Свита в общественном достоянии по возрасту, условия ставит оцифровщик. "
                    + "Новый Завет этого же издания в выгрузку не входит.",
            },
        ],
        pointers: [
            {
                what: "Церковнославянская Библия — Елизаветинская, 1751",
                why: "Наша копия взята с bible.by/elzs, условий распространения там не заявлено.",
                where: "Издание в общественном достоянии по возрасту; оцифровки есть у нескольких проектов.",
            },
            {
                what: "Латинская Библия — Вульгата Климентины",
                why: "Наша копия взята из чужой оцифровки.",
                where: "github.com/lb42/vulgClem — там же смотрите её условия.",
            },
        ],
    },
    {
        id: "temples",
        title: "Храмы и престолы",
        license: ODBL,
        attribution:
            "© участники OpenStreetMap (ODbL); данные Wikidata (CC0); "
            + "разметка престолов — проект «Уставные чтения» (typikon.su)",
        rationale:
            "Каталог выведен из OpenStreetMap (53 091 запись) и Wikidata (11 763). OSM "
            + "распространяется под ODbL: она требует указания источника и держит производные "
            + "базы на тех же условиях. Поэтому слой отдельный и НЕ под CC BY 4.0 — иначе мы "
            + "пересдавали бы чужую базу на своих условиях. Наша работа здесь — разбор "
            + "посвящений (какому святому престол), привязка к уставу и сведение с каталогом "
            + "святых; она отдаётся вместе со слоем на условиях слоя.",
        collections: [
            {
                source: "temples",
                file: "temples",
                title: "Храмы с престолами",
                note: "Присоединяется к dedications и saints из слоя corpus по их идентификаторам.",
            },
        ],
    },
];

/**
 * Коллекции, которые наружу не идут, и почему. Список закрытый: он же служит
 * доказательством, что о каждой таблице базы подумали.
 */
export const EXCLUDED: Record<string, string> = {
    dneslov_names: "снимок чужих святцев (dneslov.org), условия правообладателем не заявлены",
    dneslov_memories: "то же",
    notes: "рабочие заметки набора",
    channelPosts: "очередь автопостинга, служебное",
    mentionCandidates: "черновики разметки упоминаний, не выверены",
    parishEdits: "правки приходского расписания — чужие данные приходов",
    parishSchedules: "то же",
    parishSettings: "то же",
    templeAdmins: "кто ведёт расписание храма — персональные данные",
    templeClaims: "заявки на ведение — персональные данные",
    dates: "пустая коллекция, оставшаяся от прежней модели",
};

/** Коллекции, которые уходят наружу хотя бы одним файлом. */
export const exportedCollections = (): Set<string> => {
    const names = new Set<string>();
    LAYERS.forEach((layer) => layer.collections.forEach((collection) => {
        if (collection.source) names.add(collection.source);
    }));
    return names;
};

/**
 * Коллекции базы, о которых никто ничего не сказал. Сборка на этом останавливается:
 * молчание не значит «можно выкладывать».
 */
export const unclassified = (collectionNames: string[]): string[] => {
    const exported = exportedCollections();
    return collectionNames
        .filter((name) => !exported.has(name) && !(name in EXCLUDED))
        .sort();
};

/**
 * Приведение документа к простому JSON: ObjectId — строкой, дата — по ISO,
 * ключи по алфавиту. Сортировка ключей нужна не для красоты: без неё две сборки
 * на одной базе давали бы разные байты, и сверить выгрузки было бы нечем.
 */
export const normalize = (value: any): any => {
    if (value === null || value === undefined) return null;

    if (typeof value?.toHexString === "function") return value.toHexString();
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map(normalize);

    if (typeof value === "object") {
        const out: Record<string, any> = {};
        Object.keys(value).sort().forEach((key) => {
            out[key] = normalize(value[key]);
        });
        return out;
    }

    return value;
};

/** Документ наружу: снятые поля и приведение к простому JSON. */
export const prepare = (doc: Record<string, any>, drop?: Record<string, string>): any => {
    const copy: Record<string, any> = {};
    Object.keys(doc).forEach((key) => {
        if (drop && key in drop) return;
        copy[key] = doc[key];
    });
    return normalize(copy);
};

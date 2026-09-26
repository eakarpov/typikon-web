import { DumpLicense, LAYERS } from "@/scripts/lib/dumpLayers";
import { SITE_HOST, SITE_URL } from "@/utils/site";

// Как выгрузка ложится в архив, выдающий DOI.
//
// ПОЧЕМУ ЗАПИСЕЙ ДВЕ, А НЕ ОДНА. У записи в архиве одна лицензия на всю запись,
// а у нашей выгрузки условия разные по слоям: корпус и Библия под CC BY, каталог
// храмов под ODbL, потому что пятьдесят с лишним тысяч записей в нём выведены из
// OpenStreetMap. Указать «CC BY» на всё разом было бы проще и было бы неправдой
// ровно в том месте, вокруг которого выстроен весь разбор прав.
//
// Отсюда же правило, проверяемое тестом: каждый слой входит ровно в одну запись.
// Забытый слой не попал бы в архив молча — а забыть его легче всего именно при
// заведении нового.
//
// Текст для формы выводится ОТСЮДА и из манифеста, а не пишется заново перед
// каждой загрузкой: числа меняются с каждой сборкой, и переписанное руками
// описание устаревает первым.

export interface DepositDoi {
    /** DOI записи вообще: всегда ведёт на последнюю версию. */
    concept?: string;
    /** DOI этой версии. Им ссылаются в работах. */
    version?: string;
}

export interface DepositRecord {
    id: string;
    /** Слои выгрузки, входящие в эту запись. */
    layers: string[];
    title: string;
    /** Заголовок латиницей: архив читают и не по-русски. */
    titleEn: string;
    license: DumpLicense;
    keywords: string[];
    /** Чем запись отличается от соседней — первым абзацем описания. */
    summary: string;
    doi?: DepositDoi;
}

const layerOf = (id: string) => {
    const layer = LAYERS.find((candidate) => candidate.id === id);
    if (!layer) throw new Error(`в записи назван слой ${id}, которого в выгрузке нет`);
    return layer;
};

export const DEPOSITS: DepositRecord[] = [
    {
        id: "corpus",
        layers: ["corpus", "bible"],
        title: "Корпус «Уставные чтения»: тексты, ударения, чтения дня и согласование библейских нумераций",
        titleEn:
            "Typikon Readings Corpus: Church Slavonic liturgical texts, accentuation, "
            + "lectionary and Bible versification concordance",
        license: layerOf("corpus").license,
        keywords: [
            "Church Slavonic", "Typikon", "liturgical texts", "lectionary",
            "Bible versification", "hagiography", "biblical geography",
            "церковнославянский язык", "богослужебные тексты", "месяцеслов", "версификация",
        ],
        summary:
            "Корпус церковнославянских уставных чтений по Типикону: наборный текст памятников, "
            + "расстановка ударений, привязка чтений к дням церковного года, разметка зачал, "
            // Числа в сводке не ставим НАМЕРЕННО — по той же причине, по какой
            // описание выводится, а не пишется: изданий было шесть, стало
            // одиннадцать, и «по шести» пережило бы правку молча. Сколько их в
            // ЭТОЙ сборке, говорит manifest.json и строки слоёв ниже.
            + "святцы, библейская география и согласование библейских нумераций между "
            + "изданиями разных традиций.",
        // Выложено в Zenodo 22 сентября 2026, версия 2026-09-21.
        // https://zenodo.org/records/22883965
        doi: {
            concept: "10.5281/zenodo.22883964",
            version: "10.5281/zenodo.22883965",
        },
    },
    {
        id: "fathers",
        layers: ["fathers"],
        title:
            "Святоотеческие тексты на церковнославянском: уставные чтения, "
            + "толкования и жития с разметкой и привязкой к богослужебному году",
        titleEn:
            "Church Slavonic patristic readings, biblical commentaries and saint "
            + "lives with lectionary linkage",
        license: layerOf("fathers").license,
        keywords: [
            "Church Slavonic", "patristics", "Fathers of the Church", "John Chrysostom",
            "Theophylact of Ohrid", "hagiography", "lectionary", "biblical exegesis",
            "ascetic literature",
            "церковнославянский язык", "святоотеческие тексты", "патристика",
            "жития святых", "уставные чтения", "библейская экзегетика",
        ],
        summary:
            "Наборный текст святоотеческих памятников (Златоуст, Феофилакт, Шестоднев, "
            + "Толковый апостол, Лествица, Паренесис, Маргарит, торжественники, "
            + "синаксари) и житий святых (Прологи) с расстановкой ударений, ссылками "
            + "на сканы-источники и привязкой чтений к дням церковного года. Срез "
            + "корпуса: те же текста есть и в записи «Корпус „Уставные чтения“», "
            + "условия у обеих CC BY 4.0. Часть текстов — заглушки со ссылками на "
            + "сканы; сводка готовности по книгам прилагается (readiness).",
        doi: {
            concept: "10.5281/zenodo.22982514",
            version: "10.5281/zenodo.22982515"
        }
    },
    {
        id: "temples",
        layers: ["temples"],
        title: "Каталог православных храмов с разобранными престолами",
        titleEn: "Orthodox churches with parsed altar dedications",
        license: layerOf("temples").license,
        keywords: [
            "Orthodox churches", "altar dedications", "OpenStreetMap", "Wikidata",
            "православные храмы", "престолы", "церковная география",
        ],
        summary:
            "Храмы с координатами и разобранными престолами: чему посвящён каждый и с какой "
            + "памятью месяцеслова это связано, то есть с каким днём церковного года.",
        // Выложено в Zenodo 22 сентября 2026, версия 2026-09-21.
        // https://zenodo.org/records/22884108
        doi: {
            concept: "10.5281/zenodo.22884107",
            version: "10.5281/zenodo.22884108",
        },
    },
];

/** Слои, не попавшие ни в одну запись. Пусто — значит ничего не забыли. */
export const unassignedLayers = (): string[] => {
    const assigned = new Set(DEPOSITS.flatMap((record) => record.layers));
    return LAYERS.map((layer) => layer.id).filter((id) => !assigned.has(id)).sort();
};

/** Слои, попавшие сразу в две записи: один и тот же файл в двух архивах с разными условиями. */
export const duplicatedLayers = (): string[] => {
    const seen = new Map<string, number>();
    for (const record of DEPOSITS) {
        for (const id of record.layers) seen.set(id, (seen.get(id) ?? 0) + 1);
    }
    return [...seen.entries()].filter(([, times]) => times > 1).map(([id]) => id).sort();
};

export const recordOfLayer = (layerId: string): DepositRecord | undefined =>
    DEPOSITS.find((record) => record.layers.includes(layerId));

interface LayerNumbers {
    id: string;
    title: string;
    files: number;
    records: number;
    /** Файлы, у которых условия не те, что у записи: их надо назвать поимённо. */
    exceptions: { path: string; license: string; attribution?: string }[];
}

/**
 * Описание для формы архива. Собирается из чисел СБОРКИ, а не из памяти: после
 * каждой пересборки описание должно говорить правду о том, что в архиве лежит.
 */
export const depositDescription = (record: DepositRecord, layers: LayerNumbers[]): string => {
    const lines: string[] = [record.summary, ""];

    for (const layer of layers) {
        lines.push(
            `Слой ${layer.id} (${layer.files} ${plural(layer.files, "файл", "файла", "файлов")}, `
            + `${layer.records.toLocaleString("ru-RU")} ${plural(layer.records, "запись", "записи", "записей")}): `
            + `${layer.title}.`,
        );
    }

    lines.push(
        "",
        "Формат — JSON Lines под gzip, строка на запись. В manifest.json перечислены все файлы "
        + "с числом записей, размерами и sha256; сборка воспроизводима: две сборки на одной базе "
        + "дают одинаковые суммы.",
    );

    const exceptions = layers.flatMap((layer) => layer.exceptions);
    if (exceptions.length) {
        lines.push(
            "",
            `ОБ УСЛОВИЯХ. Лицензия записи — ${record.license.id}, и под ней идёт всё, сделанное в `
            + "проекте. Перечисленные ниже файлы идут на условиях своих правообладателей; это "
            + "указано у каждого файла в манифесте и в LICENSE слоя, а полные тексты лицензий, "
            + "где они требуются, лежат рядом с данными.",
        );
        for (const file of exceptions) {
            lines.push(
                `— ${file.path}: ${file.license}${file.attribution ? `, ${file.attribution}` : ""}`,
            );
        }
    }

    const others = DEPOSITS.filter((other) => other.id !== record.id);
    if (others.length) {
        lines.push(
            "",
            "Остальное из той же выгрузки выложено отдельными записями — условия у них другие: "
            + others.map((other) => `«${other.title}» (${other.license.id})`).join(", ")
            + `. Вся выгрузка целиком и её прежние версии: ${SITE_URL}/data`,
        );
    }

    lines.push("", `Источник: ${SITE_HOST}`);

    return lines.join("\n");
};

/** Русская форма числа. Своя, чтобы модуль не тянул в скрипты ничего из веба. */
const plural = (count: number, one: string, few: string, many: string): string => {
    const mod100 = count % 100;
    if (mod100 >= 11 && mod100 <= 14) return many;
    const mod10 = count % 10;
    if (mod10 === 1) return one;
    if (mod10 >= 2 && mod10 <= 4) return few;
    return many;
};

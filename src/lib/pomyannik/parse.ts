import { nameKey, normalizeName } from "@/lib/imeniny/core";
import { RANKS, type PersonKind, type PersonInput, type Rank, type Sex, MAX_BATCH } from "@/lib/pomyannik/types";
import { guessSex } from "@/lib/pomyannik/names";

// РАЗБОР СПИСКА ИМЁН.
//
// Помянник заводят не с одного имени, а с тридцати: род, крестники, усопшие
// сродники. Вбивать их по одному в поле с кнопкой — работа на вечер, и до конца
// её никто не доводит. Оттого главный способ завести помянник — переписать его
// с бумажного разворота как есть, строкой на имя:
//
//     Николай
//     Мария, мл.
//     Иоанн, †12.03.2019
//     Георгий, болящий, р.14.06.1978
//
// РАЗБОР ТЕРПИМЫЙ, А НЕ СТРОГИЙ. Строка, которую мы не поняли, не отвергается:
// имя из неё берётся, непонятое кладётся в родство, и человек видит разбор
// таблицей прежде записи. Отказ здесь стоил бы дороже ошибки: переписывающий
// помянник с бумаги не должен угадывать наш синтаксис.

// ЧТО СТОИТ ПЕРЕД ДАТОЙ: чем она является.
//
// Длинные виды идут ПЕРВЫМИ. Чередование в регулярном выражении берёт первую
// подошедшую ветвь, а не самую длинную, и при обратном порядке «ум. 12.03.2019»
// разбиралось как «у» плюс невнятный остаток «м. 12.03.2019» — дата пропадала
// молча. По той же причине после пометы требуется точка или пробел: иначе
// «Ульяна» начиналась бы с пометы «у».
const DATE_MARKS: Array<[RegExp, "died" | "born" | "baptized"]> = [
    [/^[†+✝]\s*/, "died"],
    [/^(преставился|преставилась|скончался|скончалась|умерла|умер|сконч|ум|у)(\.|\s)\s*/i, "died"],
    [/^(родился|родилась|род|р)(\.|\s)\s*/i, "born"],
    [/^(крещена|крещён|крещен|крещ|кр)(\.|\s)\s*/i, "baptized"],
];

/** Сокращения, какими пометы пишут в бумажном помяннике. */
const RANK_ALIASES: Record<string, Rank> = {
    "мл": "mladenets", "млад": "mladenets", "младенца": "mladenets",
    "отр": "otrok", "отрока": "otrok", "отроковицы": "otrokovitsa",
    "бол": "bolyashchiy", "болящая": "bolyashchiy", "болящего": "bolyashchiy",
    "болящей": "bolyashchiy", "болн": "bolyashchiy",
    "пут": "puteshestvuyushchiy", "путешествующая": "puteshestvuyushchiy",
    "воина": "voin", "закл": "zaklyuchennyy", "заключённая": "zaklyuchennyy",
    "заключенный": "zaklyuchennyy", "заключенная": "zaklyuchennyy",
    "непр": "neprazdnaya", "уб": "ubiennyy", "убиенная": "ubiennyy",
    "убиенного": "ubiennyy", "уб-го": "ubiennyy",
    "иер": "ierey", "прот": "protoierey", "прот-й": "protoierey",
    "иером": "ieromonah", "архим": "arhimandrit", "игум": "igumen",
    "игумении": "igumen", "игумения": "igumen",
    "диак": "diakon", "прдиак": "protodiakon", "протодиак": "protodiakon",
    "мон": "monah", "монахини": "monah", "монахиня": "monah",
    "схим": "shimonah", "схимонахиня": "shimonah",
    "инокини": "inok", "инокиня": "inok", "посл": "poslushnik",
    "послушницы": "poslushnik", "послушница": "poslushnik",
    "архиер": "arhierey", "еп": "arhierey", "епископа": "arhierey",
};

const RANK_INDEX: Record<string, Rank> = (() => {
    const out: Record<string, Rank> = { ...RANK_ALIASES };
    for (const rank of RANKS) {
        for (const word of [rank.label, rank.genitive,
                            rank.feminine?.label, rank.feminine?.genitive]) {
            if (word) out[word.toLowerCase().replace(/ё/g, "е")] = rank.key;
        }
    }
    return out;
})();

const cleanWord = (raw: string) => raw.trim().toLowerCase().replace(/ё/g, "е").replace(/\.$/, "");

/** «12.03.2019», «12.3.2019», «2019-03-12». Двузначного года не понимаем нарочно. */
const parseDate = (raw: string): string | null => {
    const value = raw.trim();
    const dotted = /^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/.exec(value);
    if (dotted) {
        const [, d, m, y] = dotted;
        const date = new Date(Number(y), Number(m) - 1, Number(d), 12);
        if (date.getMonth() !== Number(m) - 1 || date.getDate() !== Number(d)) return null;
        return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    const isoLike = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
    if (isoLike) {
        const [, y, m, d] = isoLike;
        const date = new Date(Number(y), Number(m) - 1, Number(d), 12);
        if (date.getMonth() !== Number(m) - 1 || date.getDate() !== Number(d)) return null;
        return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    return null;
};

export interface ParsedLine {
    /** Номер строки в том, что ввёл человек, — чтобы показать, где непонятое. */
    line: number;
    raw: string;
    person: PersonInput | null;
    /** Что в строке осталось непонятым. Не ошибка, а повод показать словами. */
    unparsed: string[];
}

/**
 * Разбор одной строки.
 *
 * Имя — первое, что в строке стоит; остальное через запятую в любом порядке.
 * Дата с крестом или «ум.» делает лицо усопшим — отдельно об этом говорить не
 * надо: в бумажном помяннике так и пишут.
 */
export const parseLine = (raw: string, line = 0, kind: PersonKind = "living"): ParsedLine => {
    const text = raw.replace(/\s+/g, " ").trim();
    if (!text || /^[#;/]/.test(text)) return { line, raw, person: null, unparsed: [] };

    const parts = text.split(/[,;]/).map(p => p.trim()).filter(Boolean);
    const name = normalizeName(parts.shift() ?? "");
    if (!name || !nameKey(name)) {
        return { line, raw, person: null, unparsed: text ? [text] : [] };
    }

    const person: PersonInput = { name, kind };
    const unparsed: string[] = [];
    const relation: string[] = [];

    for (const part of parts) {
        let handled = false;

        for (const [mark, field] of DATE_MARKS) {
            const found = mark.exec(part);
            if (!found) continue;
            const date = parseDate(part.slice(found[0].length));
            if (!date) break;
            person[field] = date;
            if (field === "died") person.kind = "departed";
            handled = true;
            break;
        }
        if (handled) continue;

        const rank = RANK_INDEX[cleanWord(part)];
        if (rank) { person.rank = rank; continue; }

        // Голая дата без пометы: у усопшего это день преставления, у живого —
        // день рождения. Так пишут в помяннике, и гадать тут не о чем.
        const bare = parseDate(part);
        if (bare) {
            if (person.kind === "departed") person.died = bare;
            else person.born = bare;
            continue;
        }

        // Не дата и не чин — значит родство: «мама», «крёстный», «сосед».
        // Длинное в родство не берём: это уже не помета, а чужая строка.
        if (part.length <= 40) relation.push(part);
        else unparsed.push(part);
    }

    if (relation.length) person.relation = relation.join(", ");
    person.sex = guessSex(name) as Sex;

    return { line, raw, person, unparsed };
};

export interface ParsedBatch {
    lines: ParsedLine[];
    /** Сколько имён разобралось. */
    count: number;
    /** Строк было больше, чем берём за раз. */
    truncated: boolean;
}

/**
 * Разбор целого списка.
 *
 * Раздел («о здравии», «о упокоении») можно назвать прямо в тексте заголовком —
 * так помянник и разграфлён на бумаге:
 *
 *     о здравии
 *     Николай
 *     о упокоении
 *     Иоанн
 */
export const parseList = (text: string, kind: PersonKind = "living"): ParsedBatch => {
    const rows = String(text ?? "").split(/\r?\n/);
    const lines: ParsedLine[] = [];
    let current = kind;
    let truncated = false;

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const heading = cleanWord(row).replace(/[:.]+$/, "");
        if (/^о\s*здрав/.test(heading)) { current = "living"; continue; }
        if (/^о\s*упокоен/.test(heading) || /^за\s*упокой/.test(heading)) {
            current = "departed";
            continue;
        }

        const parsed = parseLine(row, i + 1, current);
        if (!parsed.person && !parsed.unparsed.length) continue;

        if (lines.filter(l => l.person).length >= MAX_BATCH && parsed.person) {
            truncated = true;
            break;
        }
        lines.push(parsed);
    }

    return { lines, count: lines.filter(l => l.person).length, truncated };
};

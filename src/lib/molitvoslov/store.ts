import { rulesDb } from "@/lib/rulesDb";
import type { PrayerGender } from "@/lib/molitvoslov/named";
import { buildPosledovanieRows, type BuiltPosledovanieRow, type PosledovanieRowInput } from "@/lib/molitvoslov/posledovanie";
import { canRedistribute } from "@/lib/molitvoslov/rights";

// МОЛИТВОСЛОВ В rulesDb: чтение поимённых молитв и келейных последований.
//
// Тексты лежат в fixed_texts, их места и порядок — в fixed_text_occurrences
// (book='molitvoslov', адрес моментом из spec/registry/kelia-moments.yaml
// соседнего проекта). Молитвослов азбучный мигрирован туда же, поэтому обе
// ручки читают один склад — сайт печатает молитвослов публично, и ворота
// прав (rights.ts) здесь пропускают ровно тот набор, что показывает сайт:
// гражданский и уставный слои; английский слой в выгрузку не шёл — молчит.
//
// ЯЗЫКОВАЯ ОСТОРОЖНОСТЬ. Не всякая книга издана в корпусе обоими слоями:
// у Служебника уставного слоя нет вовсе, благодарственные молитвы и правило
// Серафима изданы только гражданским. Просили 'cu', а слоя нет — отдаём
// гражданский и говорим об этом полем lang ответа: молча оставить читателя
// без молитвы хуже, чем дать ей начертание, которое он умеет читать.

/** Языки, на которые издан молитвослов в корпусе. */
export const PRAYER_LANGS = ["cu_gr", "cu"] as const;
export type PrayerLang = (typeof PRAYER_LANGS)[number];

const DEFAULT_LANG: PrayerLang = "cu_gr";

// --- Поимённые молитвы ------------------------------------------------------
//
// style → для кого → координаты текстов. Координата либо момент вхождения
// (молитвослов: одному стилю отвечает целое место, и женский вариант строки
// живёт у вхождения, text_id_f), либо сам text_id (служебник: места
// поминовения адресуются прямо, уставного слоя книга не печатает и женского
// варианта не выделяет). titled=false — у всего помянника одна подпись
// («О живых»), повторять её на каждой строке смысла нет.

export type NamedFor = "living" | "departed";

export type NamedStyleKey =
    | "molitvoslov-short"
    | "molitvoslov-pomyanik"
    | "litiya"
    | "proskomidia"
    | "liturgy-ektinia";

interface NamedEntry {
    moment?: string;
    textId?: string;
    titled: boolean;
}

export const NAMED_STYLES: Record<NamedStyleKey, Record<NamedFor, NamedEntry[]>> = {
    "molitvoslov-short": {
        living: [{ moment: "utrennie/o-zhivyh", titled: true }],
        departed: [{ moment: "utrennie/ob-usopshih", titled: true }],
    },
    "molitvoslov-pomyanik": {
        living: [{ moment: "utrennie/pomyannik-o-zhivyh", titled: false }],
        departed: [{ moment: "utrennie/pomyannik-ob-usopshih", titled: false }],
    },
    // Заупокойная лития; чин о здравии книга не печатает.
    litiya: {
        living: [],
        departed: [
            { textId: "sluzhebnik-litia-o-usopshih-0021", titled: true },
            { textId: "sluzhebnik-litia-o-usopshih-0022", titled: true },
        ],
    },
    proskomidia: {
        living: [{ textId: "sluzhebnik-liturgia-chin-0103", titled: true }],
        departed: [{ textId: "sluzhebnik-liturgia-chin-0106", titled: true }],
    },
    // Ектения о усопших на литургии; о живых ектения поминовения поимённо
    // не читается.
    "liturgy-ektinia": {
        living: [],
        departed: [{ textId: "sluzhebnik-liturgia-zlatoust-0141", titled: true }],
    },
};

export const NAMED_STYLE_KEYS = Object.keys(NAMED_STYLES) as NamedStyleKey[];
export const NAMED_FOR_KINDS: NamedFor[] = ["living", "departed"];

// --- Последования -----------------------------------------------------------

/** Ключ ручки → раздел книги. Ключи названы по-приходски (в адресе ручки),
 *  разделы — слаги издания; сверены с parsed/molitvoslov и kelia-moments.yaml:
 *  у каждого из девяти раздела есть вхождения в базе. */
export const POSLEDOVANIYA: Record<string, string> = {
    "utrennie": "utrennie",
    "na-son": "na-son",
    "ko-prichashcheniyu": "ko-prichashcheniyu",
    "blagodarstvennye": "blagodarstvennye",
    "tri-kanona-pokajannyj": "trekhkanonnik",
    "kanon-molebnyj-bogorodice": "kanon-bogorodice",
    "kanon-angelu-xranitelyu": "kanon-angelu-hranitelyu",
    "pravilo-serafima": "serafimovo",
    "chin-kelejnogo-chteniya": "chin-kanonov-i-akafistov",
};

export const POSLEDOVANIYE_KEYS = Object.keys(POSLEDOVANIYA);

// --- Чтение -----------------------------------------------------------------

interface OccurrenceRow {
    text_id: string;
    seq: number;
    slot_label: string | null;
    lead_label: string | null;
    repeat_count: number | null;
    poklon: string | null;
    kind: string;
    language: string;
    text: string;
    source_book: string | null;
    text_f: string | null;
}

const OCCURRENCE_SQL = `
    SELECT o.text_id, o.seq, o.slot_label, o.lead_label, o.repeat_count, o.poklon,
           t.kind, t.language, t.text, t.source_book, f.text AS text_f
    FROM fixed_text_occurrences o
    JOIN fixed_texts t ON t.text_id = o.text_id
    LEFT JOIN fixed_texts f ON f.text_id = o.text_id_f
    WHERE o.book = 'molitvoslov' AND t.language = ?`;

const byMoment = (moment: string, lang: PrayerLang): OccurrenceRow[] =>
    (rulesDb()?.prepare(`${OCCURRENCE_SQL} AND o.moment = ? ORDER BY o.seq`).all(lang, moment)
        ?? []) as OccurrenceRow[];

const bySection = (section: string, lang: PrayerLang): OccurrenceRow[] =>
    (rulesDb()?.prepare(`${OCCURRENCE_SQL} AND o.section = ? ORDER BY o.seq`).all(lang, section)
        ?? []) as OccurrenceRow[];

const byTextId = (textId: string, lang: PrayerLang): OccurrenceRow[] =>
    (rulesDb()?.prepare(`
        SELECT o.text_id, o.seq, o.slot_label, o.lead_label, o.repeat_count, o.poklon,
               t.kind, t.language, t.text, t.source_book, NULL AS text_f
        FROM fixed_texts t
        LEFT JOIN fixed_text_occurrences o ON o.text_id = t.text_id
        WHERE t.text_id = ? AND t.language = ?
        ORDER BY o.occurrence_id LIMIT 1`).all(textId, lang)
        ?? []) as OccurrenceRow[];

const allowed = (row: OccurrenceRow): boolean => canRedistribute(row.source_book, row.language);

/** Слой языка: просили — берём; нет в корпусе — гражданский. */
const withLangFallback = <T>(fetchLang: (lang: PrayerLang) => T[], lang: PrayerLang): {
    lang: PrayerLang;
    rows: T[];
} => {
    const asked = fetchLang(lang);
    if (asked.length || lang === DEFAULT_LANG) return { lang, rows: asked };
    return { lang: DEFAULT_LANG, rows: fetchLang(DEFAULT_LANG) };
};

export interface NamedPrayerText {
    id: string;
    title: string | null;
    text: string;
}

/**
 * Тексты стиля, готовые к подстановке имён (подстановка — у ручки, см.
 * @/lib/molitvoslov/named). Возвращает null, когда корпуса нет вовсе —
 * отличать «корпуса нет» от «стиля нет» обязана ручка.
 */
export const namedPrayerTexts = (
    entries: NamedEntry[],
    lang: PrayerLang,
    gender: PrayerGender,
): { lang: PrayerLang; prayers: NamedPrayerText[] } | null => {
    if (!rulesDb()) return null;

    const prayed: NamedPrayerText[] = [];
    let served: PrayerLang = lang;
    for (const entry of entries) {
        const { lang: used, rows } = withLangFallback(
            (l) => (entry.moment ? byMoment(entry.moment, l) : byTextId(entry.textId ?? "", l)),
            lang,
        );
        served = used;
        for (const row of rows) {
            if (!allowed(row)) continue;
            prayed.push({
                id: row.text_id,
                title: entry.titled ? row.slot_label ?? null : null,
                text: gender === "f" && row.text_f ? row.text_f : row.text,
            });
        }
    }
    return { lang: served, prayers: prayed };
};

export interface PosledovanieResult {
    lang: PrayerLang;
    rows: BuiltPosledovanieRow[];
}

/**
 * Последование целиком: строки в порядке печати, права применены, женские
 * варианты выбраны. null — корпуса нет вовсе.
 */
export const posledovanieTexts = (
    section: string,
    lang: PrayerLang,
    gender: PrayerGender,
): PosledovanieResult | null => {
    if (!rulesDb()) return null;

    const { lang: used, rows } = withLangFallback((l) => bySection(section, l), lang);
    const inputs: PosledovanieRowInput[] = rows.filter(allowed).map((row) => ({
        id: row.text_id,
        seq: row.seq,
        label: row.slot_label,
        lead: row.lead_label,
        repeatCount: row.repeat_count,
        poklon: row.poklon,
        kind: row.kind,
        text: row.text,
        textF: row.text_f,
    }));
    return {
        lang: used,
        rows: buildPosledovanieRows(inputs, gender),
    };
};

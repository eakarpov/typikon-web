import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import {
    ADJ_SLOTS,
    SLOTS,
    VERB_SLOTS,
    conjugate,
    decline,
    declineAdjective,
    declineParticiple,
    type AdjSlot,
    type Slot,
    type VerbSlot,
} from "@/lib/morphology/decline";
import {
    adjectiveReading,
    analyses,
    isAbbreviation,
    nounSlots,
    partOfSpeech,
    verbSlot,
    type PartOfSpeech,
} from "@/lib/morphology/tags";

// Страница словаря собирает парадигму на сервере: и порождение по таблицам, и
// наложение выписанных в словаре форм. Клиенту уходит готовая сетка — списки строк
// по ячейкам, без лексемы и без схем.

/** Форма с пометой, откуда она: из словаря или порождена по парадигме. */
export interface Form {
    value: string;
    stored: boolean;
}

/** Причастие: своя основа и своё склонение — прилагательным. */
export interface ParticipleView {
    title: string;
    base: string;
    table: { brev: Record<AdjSlot, Form[]>; plen: Record<AdjSlot, Form[]> };
}

export interface LexemeView {
    id: string;
    name: string;
    scheme: string;
    properties: string[];
    pos: PartOfSpeech;
    /** Есть ли для схемы таблица. Нет — показываем только выписанные формы. */
    known: boolean;
    noun?: Record<Slot, Form[]>;
    adjective?: { brev: Record<AdjSlot, Form[]>; plen: Record<AdjSlot, Form[]> };
    verb?: Record<VerbSlot, Form[]>;
    /** Причастия глагола — отдельными парадигмами, а не строкой в спряжении. */
    participles?: ParticipleView[];
    /** Формы словаря, которые никуда не легли: сокращения под титлом и прочее. */
    extra: { value: string; properties: string }[];
}

interface StoredForm { value?: string; properties?: string }

// Сравниваем с точностью до графики: словарь набран без ѧ, ꙗ и ꙋ, а порождение
// выходит в церковнославянской графике, и «глаго́лаху» со «глаго́лахꙋ» — одно слово.
// Без этого каждая вторая ячейка показывала бы одну форму дважды.
const key = (value: string) =>
    value.normalize("NFD").replace(/[̀-ͯ҃-҉]/g, "").toLowerCase()
        .replace(/ᲂу/g, "у").replace(/[ѧꙗѩ]/g, "я").replace(/[ꙋѹ]/g, "у");

const same = (a: string, b: string) => key(a) === key(b);

/** Складывает порождённое и выписанное: словарная форма всегда впереди. */
const merge = <K extends string>(
    generated: Record<K, string[]>,
    stored: Map<K, string[]>,
    slots: K[],
): Record<K, Form[]> => {
    const out = {} as Record<K, Form[]>;

    for (const slot of slots) {
        const fromDictionary = stored.get(slot) ?? [];
        const forms: Form[] = fromDictionary.map((value) => ({ value, stored: true }));

        for (const value of generated[slot] ?? []) {
            if (!forms.some((form) => same(form.value, value))) forms.push({ value, stored: false });
        }

        out[slot] = forms;
    }

    return out;
};

const collect = <K extends string>(map: Map<K, string[]>, slot: K, value: string) => {
    const list = map.get(slot) ?? [];
    if (!list.some((existing) => same(existing, value))) list.push(value);
    map.set(slot, list);
};

// Причастия — не строка в спряжении, а своя парадигма: они склоняются
// прилагательным, и в словаре их выписано 37 550 форм против 26 тысяч всех личных.
// Вываливать их перечнем в одну ячейку значит показать кашу вместо парадигмы.
const PARTICIPLE_TITLES: [VerbSlot, string][] = [
    ["partPresAct", "Причастие настоящего действительное"],
    ["partPresPass", "Причастие настоящего страдательное"],
    ["partPastAct", "Причастие прошедшего действительное"],
    ["partPastPass", "Причастие прошедшего страдательное"],
];

/** Основа причастия: отрезаем окончание исходной формы, оставляя «а҆́лчꙋщ-». */
const participleStem = (form: string) => form.replace(/(ый|ій|ая|ое|ъ|ь|а|о|е|и|я|ѧ|ꙗ)$/, "");

const participles = (
    forms: StoredForm[],
    conjugated: Record<VerbSlot, string[]> | null,
): ParticipleView[] => {
    const out: ParticipleView[] = [];

    for (const [slot, title] of PARTICIPLE_TITLES) {
        // Основу берём из порождённой исходной формы; если схемы нет — из словаря.
        const seed = conjugated?.[slot]?.[0]
            ?? forms.find((form) => {
                const tags = String(form.properties ?? "");
                return !isAbbreviation(tags)
                    && analyses(tags).some((analysis) => verbSlot(analysis) === slot);
            })?.value;
        if (!seed) continue;

        const base = participleStem(String(seed));
        if (!base) continue;

        const table = declineParticiple(base);
        const brevStored = new Map<AdjSlot, string[]>();
        const plenStored = new Map<AdjSlot, string[]>();

        for (const form of forms) {
            const value = String(form.value ?? "");
            const tags = String(form.properties ?? "");
            if (!value || isAbbreviation(tags)) continue;
            // Форма относится к этому причастию, только если и разбор тот, и основа та:
            // у одного глагола причастий четыре, и путать их нельзя.
            if (!analyses(tags).some((analysis) => verbSlot(analysis) === slot)) continue;
            if (key(value).indexOf(key(base)) !== 0) continue;

            for (const analysis of analyses(tags)) {
                const reading = adjectiveReading(analysis);
                for (const adjSlot of reading.slots) {
                    if (reading.plen) collect(plenStored, adjSlot, value);
                    if (reading.brev) collect(brevStored, adjSlot, value);
                }
            }
        }

        out.push({
            title,
            base,
            table: {
                brev: merge(table.brev, brevStored, ADJ_SLOTS),
                plen: merge(table.plen, plenStored, ADJ_SLOTS),
            },
        });
    }

    return out;
};

export const getItem = async (id: string): Promise<[LexemeView | null, unknown]> => {
    try {
        const client = await clientPromise;
        const lexeme = await client.db("typikon-csl").collection("lexems")
            .findOne({ _id: new ObjectId(id) });

        if (!lexeme) return [null, null];

        const name = String(lexeme.name ?? "");
        const properties = String(lexeme.properties ?? "");
        const forms = (lexeme.forms ?? []) as StoredForm[];
        const pos = partOfSpeech(properties);

        const view: LexemeView = {
            id,
            name,
            scheme: String(lexeme.scheme ?? ""),
            properties: properties.split(",").filter(Boolean),
            pos,
            known: false,
            extra: [],
        };

        // Выписанные формы раскладываем по ячейкам; что не легло — покажем списком,
        // а не выбросим: сокращения под титлом парадигме не принадлежат, но словарю
        // принадлежат, и прятать их незачем.
        const nounStored = new Map<Slot, string[]>();
        const verbStored = new Map<VerbSlot, string[]>();
        const brevStored = new Map<AdjSlot, string[]>();
        const plenStored = new Map<AdjSlot, string[]>();

        for (const form of forms) {
            const value = String(form.value ?? "");
            const tags = String(form.properties ?? "");
            if (!value) continue;

            if (isAbbreviation(tags)) { view.extra.push({ value, properties: tags }); continue; }

            let placed = false;
            for (const analysis of analyses(tags)) {
                if (pos === "noun") {
                    for (const slot of nounSlots(analysis)) { collect(nounStored, slot, value); placed = true; }
                } else if (pos === "adjective") {
                    const reading = adjectiveReading(analysis);
                    for (const slot of reading.slots) {
                        if (reading.plen) collect(plenStored, slot, value);
                        if (reading.brev) collect(brevStored, slot, value);
                        placed = true;
                    }
                } else if (pos === "verb") {
                    const slot = verbSlot(analysis);
                    if (!slot) continue;
                    // Склонённые причастия в сетку спряжения не кладём: им отведены
                    // отдельные парадигмы ниже, иначе одна ячейка съест тридцать форм.
                    const declined = slot.startsWith("part") && slot !== "partPresActSg"
                        && !(analysis.includes("sg") && analysis.includes("m") && analysis.includes("nom"));
                    if (!declined) collect(verbStored, slot, value);
                    placed = true;
                }
            }

            if (!placed) view.extra.push({ value, properties: tags });
        }

        const lex = { name, properties, scheme: view.scheme };

        if (pos === "noun") {
            const table = decline(lex);
            view.known = Boolean(table);
            view.noun = merge(table ?? ({} as Record<Slot, string[]>), nounStored, SLOTS);
        } else if (pos === "adjective") {
            const table = declineAdjective(lex);
            view.known = Boolean(table);
            view.adjective = {
                brev: merge(table?.brev ?? ({} as Record<AdjSlot, string[]>), brevStored, ADJ_SLOTS),
                plen: merge(table?.plen ?? ({} as Record<AdjSlot, string[]>), plenStored, ADJ_SLOTS),
            };
        } else if (pos === "verb") {
            const table = conjugate(lex);
            view.known = Boolean(table);
            view.verb = merge(table ?? ({} as Record<VerbSlot, string[]>), verbStored, VERB_SLOTS);
            view.participles = participles(forms, table);
        }

        return [view, null];
    } catch (e) {
        console.error(e);
        return [null, e];
    }
};

import { supplementalPersonalLexeme, feminineBaseKeys, femininePersonalLexeme, applyManualCases, personalCaseForm } from "./nameForms";
import { guessSex } from "./names";
import type { PomyannikPerson } from "./types";
import { withInitialBreathing } from "./breathing";
import clientPromise from "@/lib/mongodb";
import { cached, CacheTag } from "@/lib/cache";
import { decline } from "@/lib/morphology/decline";
import { convertText } from "@/lib/cslav/service";
import { toPlainText } from "@/lib/cslav/convert";
import { hasChurchSlavonicGraphics } from "@/lib/cslav/core";
import { lexiconKeys } from "@/lib/pomyannik/names";
import {reportError} from "@/lib/reportError";

// ИМЯ В ЗАПИСКЕ ПИШУТ ЦЕРКОВНОСЛАВЯНСКИМ И В РОДИТЕЛЬНОМ ПАДЕЖЕ: не «Иоанн», а
// «ѡ здра́вїи їѡа́нна». Обе перемены сайту по силам — словарь личных имён с
// пометой `persn` держит три с половиной тысячи лексем со схемами склонения, —
// но по силам НЕ ВЕЗДЕ, и вот об этом надо говорить честно.
//
// ТРИ ИСТОЧНИКА, И ОНИ НЕРАВНЫ.
//
//   lexicon — имя нашлось в словаре, склонение порождено его схемой. Это
//   настоящий родительный падеж, и ему можно верить.
//
//   accents — имени в словаре нет. Начертание даёт перевод гражданки в
//   церковнославянское письмо, ударение — словарь ударений. ПАДЕЖ ПРИ ЭТОМ НЕ
//   МЕНЯЕТСЯ, и притворяться, будто изменился, нельзя.
//
//   plain — не вышло и это: имя уходит как есть.
//
// Печать обязана показывать источник. Иначе выйдет худшее, что здесь возможно:
// человек примет наш именительный падеж за проверенный родительный и отдаст
// записку с ошибкой, которой сам бы не сделал.

export type SlavonicSource = "lexicon" | "accents" | "plain" | "manual";

export interface SlavonicName {
    /** Имя церковнославянским письмом, именительный падеж. */
    text: string;
    /** Он же в родительном — том, каким имя читают в записке. */
    genitive: string;
    dative?: string | null;
    hasParadigm?: boolean;
    source: SlavonicSource;
    /** Лемма словаря, если нашлась: по ней видно, что именно мы склоняли. */
    lexeme?: string;
}

interface LexemeRow {
    name: string;
    search: string;
    scheme?: string | null;
    properties?: string | null;
}

/**
 * Личное имя в словаре.
 *
 * Ищется по ВАРИАНТАМ ключа (см. names.lexiconKeys): словарное поле `search`
 * получено из славянского написания, и «Марія» лежит там под «мариа». Прямой
 * поиск промахивался бы ровно на самых частых именах.
 *
 * Помета `persn` обязательна. Без неё «Вера» нашлась бы неодушевлённой «вѣ́рой»,
 * а «Лидия» — вовсе областью Лидией: слова эти в словаре есть, но они не имена,
 * и склонять по ним человека — хуже, чем не склонять вовсе.
 */
const findLexeme = async (name: string, sex?: "m" | "f" | null): Promise<LexemeRow | null> => {
    const extra = supplementalPersonalLexeme(name);
    if (extra && sex !== "m") return extra;
    const keys = lexiconKeys(name);
    if (!keys.length) return null;

    const client = await clientPromise;
    const rows = await client.db("typikon-csl").collection("lexems")
        .find({ search: { $in: keys }, properties: /persn/ },
              { projection: { name: 1, search: 1, scheme: 1, properties: 1 } })
        .toArray();
    const suitable = rows.filter(row => !sex || String(row.properties ?? "").split(",").includes(sex));
    if (!suitable.length && sex === "f") {
        const bases = feminineBaseKeys(name);
        const male = bases.length ? await client.db("typikon-csl").collection("lexems")
            .findOne({ search: { $in: bases }, properties: /persn/ }, { projection: { name: 1, search: 1, scheme: 1, properties: 1 } }) : null;
        const derived = male ? femininePersonalLexeme(name, male as unknown as LexemeRow) : null;
        if (derived) return derived;
        // An existing exact nominative remains a valid paradigm (e.g. Косма,
        // Никита), even if an older automatic sex guess was wrong.
        return rows[0] as unknown as LexemeRow ?? null;
    }
    if (!suitable.length) return null;

    // Порядок ключей — это порядок предпочтения: сперва как набрано, потом
    // славянские виды. Первый попавшийся ответ был бы случайным.
    for (const key of keys) {
        const row = suitable.find(r => r.search === key);
        if (row) return row as unknown as LexemeRow;
    }
    return suitable[0] as unknown as LexemeRow;
};

/** Перевод гражданского написания в церковнославянское, без смены падежа. */
const byConversion = async (name: string): Promise<{ text: string } | null> => {
    try {
        const result = await convertText(name, { rule: true, accents: true, titla: false });
        const text = toPlainText(result.tokens).trim();
        return text ? { text } : null;
    } catch (e) {
        // Перевод — украшение записки, а не её суть. Сбой словаря не должен
        // мешать подать имя: ниже оно уйдёт гражданкой.
        reportError(e, { where: "lib/pomyannik/slavonic: не удалось перевести имя", extra: { name } });
        return null;
    }
};

/**
 * То же без кэша. Нужен скриптам и проверке: `cached` — обёртка Next и вне
 * запроса не работает вовсе.
 */
export const readSlavonic = async (name: string, sex?: "m" | "f" | null): Promise<SlavonicName> => {
    const clean = String(name ?? "").trim();
    if (!clean) return { text: "", genitive: "", source: "plain" };

    const lexeme = await findLexeme(clean, sex ?? guessSex(clean));
    if (lexeme?.scheme) {
        const paradigm = decline({
            name: lexeme.name, properties: lexeme.properties, scheme: lexeme.scheme,
        });
        const genitive = paradigm?.sgGen?.[0];
        if (genitive) {
            return { text: withInitialBreathing(lexeme.name), genitive: personalCaseForm(lexeme.name, genitive), dative: paradigm?.sgDat?.[0] ? personalCaseForm(lexeme.name, paradigm.sgDat[0]) : null, hasParadigm: Boolean(paradigm?.sgDat?.[0]), source: "lexicon", lexeme: lexeme.name };
        }
    }

    const converted = await byConversion(clean);
    // Перевод считается состоявшимся, только если в слове появилось славянское
    // письмо. Иначе «Светлана» вернулась бы «Светланой» с пометой «переведено»,
    // и помета соврала бы: ничего с именем не сделали.
    if (converted && hasChurchSlavonicGraphics(converted.text)) {
        // Падеж тот же, что и был. Источник об этом говорит, и печать обязана
        // это показать — здесь мы не склоняем, а только пишем.
        return { text: withInitialBreathing(converted.text), genitive: withInitialBreathing(converted.text), source: "accents" };
    }

    return { text: clean, genitive: clean, source: "plain" };
};

/**
 * Церковнославянская форма имени.
 *
 * Кэшируется надолго: имена не меняются, а словарь пополняется выкладкой, и
 * сбрасывается тем же тегом, что и прочее словарное.
 */
export const slavonicName = cached(readSlavonic, ["pomyannik-slavonic-cases-v3"], [CacheTag.TEXTS], 86400);

/** То же для списка имён — записка спрашивает сразу все. */
export const slavonicNames = async (names: string[]): Promise<Record<string, SlavonicName>> => {
    const unique = [...new Set(names.map(n => String(n ?? "").trim()).filter(Boolean))];
    const forms = await Promise.all(unique.map(name => slavonicName(name)));
    return Object.fromEntries(unique.map((name, i) => [name, forms[i]]));
};

/** Manual forms belong to one person, never to the shared name cache. */
export const personSlavonic = async (person: Pick<PomyannikPerson, "name" | "churchName" | "sex" | "manualGenitive" | "manualDative">): Promise<SlavonicName> => {
    const form = await slavonicName(person.churchName || person.name, person.sex);
    return applyManualCases(person, form, async text => (await byConversion(text))?.text ?? text);
};

import clientPromise from "@/lib/mongodb";
import { cached, CacheTag } from "@/lib/cache";
import { decline } from "@/lib/morphology/decline";
import { convertText } from "@/lib/cslav/service";
import { toPlainText } from "@/lib/cslav/convert";
import { hasChurchSlavonicGraphics } from "@/lib/cslav/core";
import { lexiconKeys } from "@/lib/pomyannik/names";

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

export type SlavonicSource = "lexicon" | "accents" | "plain";

export interface SlavonicName {
    /** Имя церковнославянским письмом, именительный падеж. */
    text: string;
    /** Он же в родительном — том, каким имя читают в записке. */
    genitive: string;
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
const findLexeme = async (name: string): Promise<LexemeRow | null> => {
    const keys = lexiconKeys(name);
    if (!keys.length) return null;

    const client = await clientPromise;
    const rows = await client.db("typikon-csl").collection("lexems")
        .find({ search: { $in: keys }, properties: /persn/ },
              { projection: { name: 1, search: 1, scheme: 1, properties: 1 } })
        .toArray();
    if (!rows.length) return null;

    // Порядок ключей — это порядок предпочтения: сперва как набрано, потом
    // славянские виды. Первый попавшийся ответ был бы случайным.
    for (const key of keys) {
        const row = rows.find(r => r.search === key);
        if (row) return row as unknown as LexemeRow;
    }
    return rows[0] as unknown as LexemeRow;
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
        console.error(`помянник: не удалось перевести имя «${name}»`, e);
        return null;
    }
};

/**
 * То же без кэша. Нужен скриптам и проверке: `cached` — обёртка Next и вне
 * запроса не работает вовсе.
 */
export const readSlavonic = async (name: string): Promise<SlavonicName> => {
    const clean = String(name ?? "").trim();
    if (!clean) return { text: "", genitive: "", source: "plain" };

    const lexeme = await findLexeme(clean);
    if (lexeme?.scheme) {
        const paradigm = decline({
            name: lexeme.name, properties: lexeme.properties, scheme: lexeme.scheme,
        });
        const genitive = paradigm?.sgGen?.[0];
        if (genitive) {
            return { text: lexeme.name, genitive, source: "lexicon", lexeme: lexeme.name };
        }
    }

    const converted = await byConversion(clean);
    // Перевод считается состоявшимся, только если в слове появилось славянское
    // письмо. Иначе «Светлана» вернулась бы «Светланой» с пометой «переведено»,
    // и помета соврала бы: ничего с именем не сделали.
    if (converted && hasChurchSlavonicGraphics(converted.text)) {
        // Падеж тот же, что и был. Источник об этом говорит, и печать обязана
        // это показать — здесь мы не склоняем, а только пишем.
        return { text: converted.text, genitive: converted.text, source: "accents" };
    }

    return { text: clean, genitive: clean, source: "plain" };
};

/**
 * Церковнославянская форма имени.
 *
 * Кэшируется надолго: имена не меняются, а словарь пополняется выкладкой, и
 * сбрасывается тем же тегом, что и прочее словарное.
 */
export const slavonicName = cached(readSlavonic, ["pomyannik-slavonic"], [CacheTag.TEXTS], 86400);

/** То же для списка имён — записка спрашивает сразу все. */
export const slavonicNames = async (names: string[]): Promise<Record<string, SlavonicName>> => {
    const unique = [...new Set(names.map(n => String(n ?? "").trim()).filter(Boolean))];
    const forms = await Promise.all(unique.map(name => slavonicName(name)));
    return Object.fromEntries(unique.map((name, i) => [name, forms[i]]));
};

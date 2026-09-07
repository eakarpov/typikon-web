import { convertWithAnswers, wordsToLookUp, type ConvertOptions, type ConvertResult } from "@/lib/cslav/convert";
import { lookupSpellings } from "@/lib/cslav/store";
import { lookupWords } from "@/lib/accents/store";
import { byRule, sentenceCase } from "@/lib/cslav/core";
import { DOMINANCE_FOR_ACCENTS, accentedByDictionary } from "@/lib/cslav/accents";
import { OMEGA_TABLE } from "@/lib/cslav/omegaTable";

// Шов между чистой разметкой и базой — единственное место, где они встречаются.
// Тот же приём, что у разметки ударений: один заход в указатель на весь текст.
//
// Заходов, впрочем, два, и второй нужен по существу. Слова, пришедшие правилом,
// выходят из него без ударения: правило знает буквы, но не знает, на какой слог
// падает голос. Зато это знает словарь ударений — тот самый, на котором стоит
// раздел «Ударения», — и спросить его стоит ровно об этих словах, а не обо всех.

export const convertText = async (
    text: string,
    options: Partial<ConvertOptions> = {},
): Promise<ConvertResult> => {
    const asked = wordsToLookUp(text);
    const answers = asked.length ? await lookupSpellings(asked) : [];
    const byWord = new Map(asked.map((key, index) => [key, answers[index]]));
    // Таблица положения омеги приезжает сюда, а не в чистое ядро: она выведена
    // скриптом из Минеи и потому данные, а не логика.
    const result = convertWithAnswers(text, byWord, { omega: OMEGA_TABLE, ...options });

    if (options.accents === false) return result;

    // Ударения — только тем, кто пришёл правилом: словарные написания их уже
    // несут, и спрашивать о них словарь ударений значит гонять базу впустую.
    const ruled = result.tokens.filter((token) => token.kind === "byRule" && token.original);
    if (!ruled.length) return result;

    const words = [...new Set(ruled.map((token) => token.original!))];
    const marks = await lookupWords(words);
    const byOriginal = new Map(words.map((word, index) => [word, marks[index]]));

    for (const token of ruled) {
        const answer = byOriginal.get(token.original!);
        if (!answer) continue;
        const accented = accentedByDictionary(token.original!, answer);
        if (!accented) continue;
        // Ударение ставится на ГРАЖДАНСКОЕ слово, и только потом к нему
        // прикладывается правило: иначе пришлось бы считать гласные в форме,
        // где диграф ука записан двумя знаками, и счёт разошёлся бы.
        const ruledAgain = byRule(accented);
        // Регистр уже решён разметкой по положению слова в тексте: прописная
        // стоит только в начале предложения. Перечитываем его с готового
        // токена, чтобы не заводить второй счёт того же самого.
        const atSentenceStart = token.text !== token.text.toLocaleLowerCase("ru");
        token.text = sentenceCase(token.original!, ruledAgain.form, atSentenceStart);
        token.rules = [...(ruledAgain.applied ?? []), "ударение"];
    }

    return result;
};

export { DOMINANCE_FOR_ACCENTS };

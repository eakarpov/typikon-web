import { lookupWords } from "@/lib/accents/store";
import { markWithAnswers, wordsToLookUp, type Genre, type MarkResult } from "@/lib/accents/mark";

// Единственное место, где разметка встречается с базой. Сама разметка
// (@/lib/accents/mark) базы не знает — потому и проверяется тестами без неё.

/** Размечает текст, спросив словарь одним запросом на весь текст. */
export const markText = async (text: string, genre: Genre = "reading"): Promise<MarkResult> => {
    const asked = wordsToLookUp(text);
    const answers = asked.length ? await lookupWords(asked) : [];
    const byWord = new Map(asked.map((word, index) => [word, answers[index]]));

    return markWithAnswers(text, byWord, genre);
};

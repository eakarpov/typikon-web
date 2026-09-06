import { convertWithAnswers, wordsToLookUp, type ConvertOptions, type ConvertResult } from "@/lib/cslav/convert";
import { lookupSpellings } from "@/lib/cslav/store";

// Шов между чистой разметкой и базой — единственное место, где они встречаются.
// Тот же приём, что у разметки ударений: один заход в указатель на весь текст.

export const convertText = async (
    text: string,
    options: Partial<ConvertOptions> = {},
): Promise<ConvertResult> => {
    const asked = wordsToLookUp(text);
    const answers = asked.length ? await lookupSpellings(asked) : [];
    const byWord = new Map(asked.map((key, index) => [key, answers[index]]));
    return convertWithAnswers(text, byWord, options);
};

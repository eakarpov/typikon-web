// Извлечение "чина" святого (мученик/преподобный/...) по родительному падежу в названии текста
// ("Страсть мученика Каллиника"). Небольшой закрытый словарь форм — работает достаточно надёжно
// сам по себе. Имя святого для хэштега в первую очередь берётся из Днеслова (buildPost.ts) —
// там оно уже в готовом виде, без необходимости угадывать склонение; имя отсюда (degenitivizeName)
// используется только если dneslovId вообще нет или Днеслов недоступен.
import { ChannelPostNameSource } from "@/types/dto/channelPost";

export interface HeroName {
    ranks: string[];
    name: string | null;
    source: ChannelPostNameSource;
}

// Родительный падеж чина -> именительный, только самые частые формы
const RANK_GENITIVE_TO_NOMINATIVE: Record<string, string> = {
    "священномученика": "священномученик",
    "священномученицы": "священномученица",
    "преподобномученика": "преподобномученик",
    "великомученика": "великомученик",
    "великомученицы": "великомученица",
    "равноапостольнаго": "равноапостольный",
    "равноапостольного": "равноапостольный",
    "равноапостольныя": "равноапостольная",
    "благовернаго": "благоверный",
    "благоверного": "благоверный",
    "благоверныя": "благоверная",
    "исповедника": "исповедник",
    "исповедницы": "исповедница",
    "новомученика": "новомученик",
    "новомученицы": "новомученица",
    "преподобнаго": "преподобный",
    "преподобного": "преподобный",
    "преподобныя": "преподобная",
    "праведнаго": "праведный",
    "праведного": "праведный",
    "праведныя": "праведная",
    "блаженнаго": "блаженный",
    "блаженного": "блаженный",
    "блаженныя": "блаженная",
    "святителя": "святитель",
    "апостола": "апостол",
    "пророка": "пророк",
    "пророчицы": "пророчица",
    "мученика": "мученик",
    "мученицы": "мученица",
    "чудотворца": "чудотворец",
    "бессребреника": "бессребреник",
    "безсребреника": "бессребреник",
    "бессребреницы": "бессребреница",
};

// Очень грубое снятие родительного падежа с имени собственного. Не претендует на
// лингвистическую точность — только чтобы было что показать в хэштеге до ручной проверки.
const degenitivizeName = (word: string): string => {
    if (/ия$/.test(word)) return word; // Илия и т.п. — им. и род. часто совпадают на письме
    if (/ы$/.test(word)) return word.replace(/ы$/, "а");
    if (/я$/.test(word)) return word.replace(/я$/, "й");
    if (/а$/.test(word)) return word.replace(/а$/, "");
    return word;
};

export const extractHeroFromHeuristic = (name?: string | null): HeroName | null => {
    if (!name) return null;
    const words = name.replace(/[.,;:!?]/g, "").split(/\s+/).filter(Boolean);

    let rankIndex = -1;
    let rankNominative: string | null = null;
    for (let i = 0; i < words.length; i++) {
        const found = RANK_GENITIVE_TO_NOMINATIVE[words[i].toLowerCase()];
        if (found) {
            rankIndex = i;
            rankNominative = found;
            break;
        }
    }

    if (rankIndex === -1 || rankIndex + 1 >= words.length) return null;

    const nameWord = words[rankIndex + 1].replace(/[^А-Яа-яЁёІіѢѣ]/g, "");
    if (!nameWord) return null;

    return {
        ranks: rankNominative ? [rankNominative] : [],
        name: degenitivizeName(nameWord),
        source: "heuristic",
    };
};

// Извлечение "чина" (мученик/преподобный/...) и имени святого в именительном падеже — нужно для
// хэштегов. Два источника, в порядке приоритета:
//   1) Днеслов — заголовок памяти там уже в готовом виде (см. getDneslovMemory), надёжнее;
//   2) эвристика по родительному падежу в названии текста ("Страсть мученика Каллиника") —
//      запасной вариант на случай отсутствия dneslovId. Точность не гарантирована, поэтому
//      результат всегда помечается source: "heuristic", чтобы страница ревью могла это подсветить.
import { ChannelPostNameSource } from "@/types/dto/channelPost";

export interface HeroName {
    rank: string | null;
    name: string | null;
    source: ChannelPostNameSource;
}

const RANKS = [
    "священномученик", "священномученица",
    "преподобномученик", "преподобномученица",
    "великомученик", "великомученица",
    "равноапостольный", "равноапостольная",
    "благоверный", "благоверная",
    "священноисповедник", "исповедник", "исповедница",
    "новомученик", "новомученица",
    "преподобный", "преподобная",
    "праведный", "праведная",
    "блаженный", "блаженная",
    "святитель", "апостол", "пророк", "пророчица",
    "мученик", "мученица",
    "чудотворец", "бессребреник", "бессребреница",
];

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
        rank: rankNominative,
        name: degenitivizeName(nameWord),
        source: "heuristic",
    };
};

export const extractHeroFromDneslovTitle = (title?: string | null): HeroName | null => {
    if (!title) return null;
    // Днеслов иногда пишет заголовок через запятую ("Каллиник, мученик") — знаки препинания
    // нужно снять с каждого слова, иначе они попадут в хэштег (#Каллиник, вместо #Каллиник).
    const words = title
        .split(/\s+/)
        .map((w) => w.replace(/[.,;:!?]+$/, "").replace(/^[.,;:!?]+/, ""))
        .filter(Boolean);
    const rankWord = words.find((w) => RANKS.includes(w.toLowerCase()));
    const nameWord = words.find((w) => /^[А-ЯЁ]/.test(w) && !RANKS.includes(w.toLowerCase()));

    if (!rankWord && !nameWord) return null;

    return {
        rank: rankWord ? rankWord.toLowerCase() : null,
        name: nameWord || null,
        source: "dneslov",
    };
};

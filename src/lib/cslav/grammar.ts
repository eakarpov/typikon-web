import type { CslVariant } from "@/lib/cslav/convert";

// Управление предлогов: чем спор о написании решается там, где частота не
// отвечает.
//
// ЗАЧЕМ. Ять и омега в спорных парах — не орфографический произвол, а
// показатель формы: «тебѣ̀» дательный, «тебѐ» винительный, «сегѡ̀» родительный
// против «сего́» винительного. Значит выбор написания есть выбор падежа, а падеж
// после предлога задан самим предлогом.
//
// ОТКУДА ТАБЛИЦА. Не из грамматики, а из собрания: у каждого слова, стоящего за
// предлогом, спрошен словарь — какой это падеж, — и посчитано, что выходит.
// Учитывались только формы с однозначным разбором; доли и объём выборки
// записаны при каждом предлоге, чтобы правило можно было пересмотреть числом.

export interface Government {
    /** Падежи, которые предлог допускает. */
    cases: string[];
    /** Доля ведущего падежа по собранию, 0..1. */
    share: number;
    /** Сколько однозначных форм за этим предлогом сосчитано. */
    samples: number;
    /**
     * Решает ли предлог спор сам.
     *
     * Решают только те, где ведущий падеж берёт девять десятых и больше.
     * Прочие сужают выбор, но оставляют его человеку: «въ» с местным в 79%
     * случаев — это не основание молча отбросить винительный.
     */
    decides: boolean;
}

export const GOVERNMENT: Record<string, Government> = {
    // Решают.
    "к": { cases: ["dat"], share: 0.96, samples: 2142, decides: true },
    "ко": { cases: ["dat"], share: 0.96, samples: 595, decides: true },
    "от": { cases: ["gen"], share: 0.91, samples: 3400, decides: true },
    "с": { cases: ["ins"], share: 0.94, samples: 1623, decides: true },
    "со": { cases: ["ins"], share: 0.94, samples: 665, decides: true },
    "при": { cases: ["loc"], share: 0.96, samples: 136, decides: true },
    "без": { cases: ["gen"], share: 0.92, samples: 451, decides: true },
    "из": { cases: ["gen"], share: 0.94, samples: 250, decides: true },
    "пред": { cases: ["ins"], share: 0.95, samples: 239, decides: true },
    "над": { cases: ["ins"], share: 0.96, samples: 105, decides: true },
    "под": { cases: ["ins"], share: 0.95, samples: 183, decides: true },
    "между": { cases: ["ins"], share: 0.97, samples: 77, decides: true },
    "до": { cases: ["gen"], share: 0.99, samples: 215, decides: true },

    // Сужают, но не решают: у них по два падежа, и оба живые.
    "в": { cases: ["loc", "acc"], share: 0.79, samples: 3924, decides: false },
    "во": { cases: ["loc", "acc"], share: 0.84, samples: 1089, decides: false },
    "на": { cases: ["acc", "loc"], share: 0.51, samples: 1158, decides: false },
    "о": { cases: ["loc", "acc"], share: 0.85, samples: 1692, decides: false },
    "по": { cases: ["dat", "loc"], share: 0.77, samples: 1785, decides: false },
    "за": { cases: ["acc", "ins"], share: 0.54, samples: 157, decides: false },
    "у": { cases: ["gen"], share: 0.73, samples: 103, decides: false },
    "чрез": { cases: ["acc"], share: 0.76, samples: 42, decides: false },

    // «Ради» сюда не входит намеренно: это послелог, он стоит ПОСЛЕ своего
    // слова («ми́лости ра́ди»), и замер это подтвердил — за ним идёт именительный
    // в 17% случаев, то есть уже следующее предложение. Управление послелога
    // требует смотреть назад, а не вперёд, и делается отдельно.
};

const CASES = new Set(["nom", "gen", "dat", "acc", "ins", "loc"]);

/** Падежи, которые допускает помета словаря: «brev,sg,m/n,gen» → {gen}. */
export const casesOf = (properties: string): Set<string> => {
    const found = new Set<string>();
    for (const tag of properties.split(/[,|/\s]+/)) {
        if (CASES.has(tag)) found.add(tag);
    }
    return found;
};

export const CASE_NAMES: Record<string, string> = {
    nom: "именительного", gen: "родительного", dat: "дательного",
    acc: "винительного", ins: "творительного", loc: "местного",
};

export interface Narrowed {
    variants: CslVariant[];
    /** Решён ли выбор управлением. */
    decided: boolean;
    /** Объяснение для читателя. */
    why: string;
}

/**
 * Сузить выбор написания по предлогу.
 *
 * Возвращает null, если предлога нет или он ничего не меняет: варианты без
 * грамматических помет не отбрасываются никогда — у них нет разбора, а не
 * неверный падеж, и выбрасывать их значило бы терять свидетельство.
 */
export const narrowByPreposition = (
    variants: CslVariant[],
    preposition: string | null,
): Narrowed | null => {
    if (!preposition) return null;
    const rule = GOVERNMENT[preposition];
    if (!rule) return null;

    const fitting = variants.filter((v) => {
        if (!v.properties) return false;
        const cases = casesOf(v.properties);
        return rule.cases.some((wanted) => cases.has(wanted));
    });
    if (!fitting.length || fitting.length === variants.length) return null;

    const rest = variants.filter((v) => !fitting.includes(v));
    const names = rule.cases.map((c) => CASE_NAMES[c]).join(" или ");
    const percent = Math.round(rule.share * 100);

    return {
        // Подходящие впереди, прочие следом: отбрасывать их нельзя — у части
        // просто нет разбора.
        variants: [...fitting, ...rest],
        decided: rule.decides && fitting.length === 1,
        why: `предлог «${preposition}» требует ${names}`
            + ` (в собрании так в ${percent}% случаев из ${rule.samples.toLocaleString("ru")})`,
    };
};

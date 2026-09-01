import { obychnaya } from "./obychnaya";
import { strastnaya } from "./strastnaya";
import { velikopostnaya } from "./velikopostnaya";
import type { ParishRule } from "../types";

export interface ParishPreset {
    key: string;
    label: string;
    note: string;
    rules: ParishRule[];
}

// Пресеты живут КОДОМ, а не записями в базе: приход их не наследует, а
// копирует себе при заведении. Наследование значило бы, что наша правка
// умолчания молча переписывает расписание живого храма, — а расписание висит
// на стенде, и молча его менять нельзя.
export const PARISH_PRESETS: Record<string, ParishPreset> = {
    obychnaya: {
        key: "obychnaya",
        label: "Обычная приходская",
        note: "Вечернее богослужение в семнадцать, литургия в девять; "
            + "повечерие и полунощница не служатся.",
        rules: obychnaya,
    },
    velikopostnaya: {
        key: "velikopostnaya",
        label: "Великопостная",
        note: "Утреня, часы и изобразительны утром; великое повечерие вечером; "
            + "Преждеосвященная по средам и пятницам.",
        rules: velikopostnaya,
    },
    strastnaya: {
        key: "strastnaya",
        label: "Страстная и Пасха",
        note: "Двенадцать Евангелий, вынос Плащаницы, погребение, пасхальная "
            + "ночь — часы обиходные, приходские.",
        rules: strastnaya,
    },
};

/** Умолчание, с которого приход начинает: обычная практика плюс постовая. */
export const DEFAULT_RULES: ParishRule[] = [
    ...obychnaya.map(r => ({ ...r, source: "preset:obychnaya" })),
    ...velikopostnaya.map(r => ({ ...r, source: "preset:velikopostnaya" })),
    ...strastnaya.map(r => ({ ...r, source: "preset:strastnaya" })),
];

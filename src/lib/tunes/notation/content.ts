// Что именно поётся на этом колене — по строке напева или по её варианту.
//
// Общее для всех нотаций: раскладка одна на всех (см. apply.ts), и содержание
// достаётся из записи одинаково — иначе крюки и ноты могли бы взять разные
// варианты одной строки и показать разное деление текста.

import type { FittedColon } from "../apply";
import type { Score } from "../types";

export const contentFor = (score: Score, colon: FittedColon): string[] =>
    (colon.variant ? score.variants?.[colon.variant] : undefined)
    ?? score.lines[colon.line]
    ?? [];

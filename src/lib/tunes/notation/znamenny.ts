// Крюковая запись: знамя над слогом, строкой обычного текста.
//
// Никакой графики здесь нет и не нужно. Знамённая нотация есть в Unicode
// (блок Znamenny Musical Notation, U+1CF00–U+1CFCF, введён в версии 14.0), и
// знамя — такой же символ, как буква: копируется, ищется, ложится в базу,
// переносится вместе со строкой. Рисовать его картинкой значило бы потерять
// всё это разом.
//
// Ограничение честное: знамёна показываются только тем, у кого стоит крюковой
// шрифт (Mezenets Unicode, Voskresensky, Smolensky Славянской компьютерной
// инициативы). Своего шрифта мы не кладём — они распространяются каждый на
// своих условиях, и вшивать их в сайт без разбора лицензий нельзя. Без шрифта
// строка знамён осыплется в пустые прямоугольники, поэтому страница говорит об
// этом словами (см. Tune.tsx), а не оставляет читателя гадать.

import type { Cell, Fitted } from "../apply";
import type { Score } from "../types";
import { cellContent, contentFor } from "./content";

export interface ZnamennyCell {
    syllable: string;
    /** Знамя. Пустая строка — шага для этого слога не нашлось. */
    neume: string;
    stressed: boolean;
    wordStart: boolean;
}

export interface ZnamennyLine {
    cells: ZnamennyCell[];
    trailing: string;
}

/**
 * Знамя для слога.
 *
 * На речитативе и на растянутом шаге знамя ПОВТОРЯЕТСЯ, а не тянется чертой:
 * так крюковая строка и пишется — сколько слогов вычитывается, столько крюков
 * и стоит подряд. Лига здесь была бы приёмом линейной записи, чужим этому
 * письму.
 */
const neumeFor = (cell: Cell, content: string[]): string => cellContent(content, cell);

export const toZnamenny = (fitted: Fitted, score: Score): ZnamennyLine[] =>
    fitted.colons.map(colon => {
        const content = contentFor(score, colon);
        return {
            trailing: colon.trailing,
            cells: colon.cells.map(cell => ({
                syllable: cell.syllable,
                neume: neumeFor(cell, content),
                stressed: cell.stressed,
                wordStart: cell.wordStart,
            })),
        };
    });

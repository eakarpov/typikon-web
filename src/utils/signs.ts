import {SIGN} from "@/types/dto/days";

export const SIGN_LABELS: Record<string, string> = {
    [SIGN.NO_SIGN]: "Без знака",
    [SIGN.HALLELUJAH]: "Аллилуйная",
    [SIGN.SIX_STICHERA]: "Шестеричная",
    [SIGN.DOXOLOGIC]: "Славословная",
    [SIGN.POLYELEOS]: "Полиелейная",
    [SIGN.VIGIL]: "Бденная",
    [SIGN.GREAT_VIGIL]: "Бдение (двунадесятый праздник)",
};

export interface ISignGlyph {
    glyph: string;
    color: "red" | "black";
}

// Юникод-символы уставных знаков и их традиционный цвет — те же глифы (U+1F540..U+1F543),
// что использует источник месяцеслова azbyka.ru и наш импортёр (см. glyphToSign в
// src/scripts/import-tipikon-menology.ts). NO_SIGN и HALLELUJAH иконки не имеют.
export const SIGN_GLYPHS: Record<string, ISignGlyph> = {
    [SIGN.GREAT_VIGIL]: {glyph: "\u{1F540}", color: "red"},
    [SIGN.VIGIL]: {glyph: "\u{1F541}", color: "red"},
    [SIGN.POLYELEOS]: {glyph: "\u{1F542}", color: "red"},
    [SIGN.DOXOLOGIC]: {glyph: "\u{1F543}", color: "red"},
    [SIGN.SIX_STICHERA]: {glyph: "\u{1F543}", color: "black"},
};

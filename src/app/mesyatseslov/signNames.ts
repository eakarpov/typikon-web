import { SIGN } from "@/types/dto/days";
import { SIGN_GLYPHS, SIGN_LABELS } from "@/utils/signs";
import { SIGN_LABELS as MEMORY_SIGN_LABELS } from "@/utils/chantLabels";

const standard: Record<string, SIGN> = {
    "bez-znaka": SIGN.NO_SIGN,
    alliluinaya: SIGN.HALLELUJAH,
    alliluynaya: SIGN.HALLELUJAH,
    shesterichnaya: SIGN.SIX_STICHERA,
    slavoslovie: SIGN.DOXOLOGIC,
    polieley: SIGN.POLYELEOS,
    bdenie: SIGN.VIGIL,
    "velikoe-bdenie": SIGN.GREAT_VIGIL,
    velikiy: SIGN.GREAT_VIGIL,
};

const special: Record<string, string> = {
    paskha: "Пасхальный чин",
    "po-paskhe": "Пасхальный чин",
    "lent-alleluia": "Постный аллилуйный чин",
    "saturday-alleluia": "Субботний аллилуйный чин",
    "polieley-postnyi": "Постный полиелей",
    "polieley-pashalnyi": "Пасхальный полиелей",
    "bdenie-postnoe": "Постное бдение",
    "bdenie-pashalnoe": "Пасхальное бдение",
};

export const signName = (key: string | null) => key
    ? special[key] ?? MEMORY_SIGN_LABELS[key] ?? SIGN_LABELS[standard[key]] ?? key
    : "Знак не определён";

export const signGlyph = (key: string | null) => {
    if (!key) return "?";
    const value = standard[key];
    if (value === SIGN.DOXOLOGIC) return SIGN_GLYPHS[value].glyph + "с";
    if (value === SIGN.SIX_STICHERA) return SIGN_GLYPHS[value].glyph + "6";
    if (value === SIGN.HALLELUJAH || key.endsWith("alleluia")) return "А";
    return SIGN_GLYPHS[value]?.glyph ?? (value === SIGN.NO_SIGN ? "–" : "·");
};

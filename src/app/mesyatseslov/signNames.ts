import { SIGN } from "@/types/dto/days";
import { SIGN_GLYPHS, SIGN_LABELS } from "@/utils/signs";
import { SIGN_LABELS as MEMORY_SIGN_LABELS } from "@/utils/chantLabels";

const standard: Record<string, SIGN> = {
    "bez-znaka": SIGN.NO_SIGN,
    alliluinaya: SIGN.HALLELUJAH,
    alliluynaya: SIGN.HALLELUJAH,
    shesterichnaya: SIGN.SIX_STICHERA,
    "shesterichnaya-pashalnaya": SIGN.SIX_STICHERA,
    slavoslovie: SIGN.DOXOLOGIC,
    polieley: SIGN.POLYELEOS,
    "polieley-postnyi": SIGN.POLYELEOS,
    "polieley-pashalnyi": SIGN.POLYELEOS,
    bdenie: SIGN.VIGIL,
    "bdenie-postnoe": SIGN.VIGIL,
    "bdenie-pashalnoe": SIGN.VIGIL,
    "velikoe-bdenie": SIGN.GREAT_VIGIL,
    velikiy: SIGN.GREAT_VIGIL,
};

const special: Record<string, string> = {
    "bez-znaka": SIGN_LABELS[SIGN.NO_SIGN],
    paskha: "Пасхальный чин",
    "po-paskhe": "Пасхальный чин",
    "lent-alleluia": "Постный аллилуйный чин",
    "saturday-alleluia": "Субботний аллилуйный чин",
    "shesterichnaya-pashalnaya": "Пасхальная шестеричная",
    "polieley-postnyi": "Постный полиелей",
    "polieley-pashalnyi": "Пасхальный полиелей",
    "bdenie-postnoe": "Постное бдение",
    "bdenie-pashalnoe": "Пасхальное бдение",
};

export const signName = (key: string | null) => key
    ? special[key] ?? MEMORY_SIGN_LABELS[key] ?? SIGN_LABELS[standard[key]] ?? key
    : "Знак не определён";

export const signMark = (key: string | null) => {
    if (!key) return { glyph: "?", color: null };
    const value = standard[key];
    if (value === SIGN.HALLELUJAH || key.endsWith("alleluia")) return { glyph: "А", color: null };
    return SIGN_GLYPHS[value] ?? { glyph: value === SIGN.NO_SIGN ? "–" : "·", color: null };
};

import { SIGN } from "@/types/dto/days";
import { SIGN_GLYPHS, SIGN_LABELS } from "@/utils/signs";
import { SIGN_LABELS as MEMORY_SIGN_LABELS } from "@/utils/chantLabels";

const standard: Record<string, SIGN> = {
    "bez-znaka": SIGN.NO_SIGN,
    alliluinaya: SIGN.HALLELUJAH,
    alliluynaya: SIGN.HALLELUJAH,
    "alliluinaya-postnaya": SIGN.HALLELUJAH,
    "lent-alleluia": SIGN.HALLELUJAH,
    "saturday-alleluia": SIGN.HALLELUJAH,
    "postnaya-prezhdeosvyashchennaya": SIGN.HALLELUJAH,
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
    "po-paskhe": "Служба с Цветной Триодью",
    "alliluinaya-postnaya": "Постная аллилуйная служба",
    "lent-alleluia": "Постный аллилуйный чин",
    "saturday-alleluia": "Субботний аллилуйный чин",
    "postnaya-prezhdeosvyashchennaya": "Постная аллилуйная служба с Литургией Преждеосвященных Даров",
    "shesterichnaya-pashalnaya": "Шестеричная служба с Цветной Триодью",
    "polieley-postnyi": "Постный полиелей",
    "polieley-pashalnyi": "Полиелей с Цветной Триодью",
    "bdenie-postnoe": "Постное бдение",
    "bdenie-pashalnoe": "Бдение с Цветной Триодью",
};

export const signName = (key: string | null) => key
    ? special[key] ?? MEMORY_SIGN_LABELS[key] ?? SIGN_LABELS[standard[key]] ?? key
    : "Знак не определён";

export const signMark = (key: string | null) => {
    if (!key) return { glyph: "?", color: null };
    const value = standard[key];
    if (value === SIGN.HALLELUJAH) return { glyph: "А", color: null };
    return SIGN_GLYPHS[value] ?? { glyph: value === SIGN.NO_SIGN ? "□" : "·", color: null };
};

// Пометы словаря → ячейки парадигмы.
//
// Одно место на всех: по этим правилам и страница словаря кладёт выписанные формы
// в сетку, и три приёмочных скрипта сверяют порождённое с хранимым. Развести их по
// разным реализациям значило бы получить страницу, которая показывает не то, что
// проверено.
//
// Помета выглядит так: «plen,sg,m,nom/acc» — полная форма, единственное число,
// мужской род, именительный или винительный. Косая черта внутри пометы — «и то и
// другое», вертикальная черта между пометами — «либо один разбор, либо другой»:
//   «brev,sg,f,nom|brev,pl,m,nom» — одно написание, служащее двум формам.
//
// Отдельно про «9^» и подобные: это пометы сокращения под титлом («а҆гг҃лъ»), их
// парадигма не порождает и порождать не должна.

import type { Slot } from "@/lib/morphology/paradigms";
import type { VerbSlot } from "@/lib/morphology/conjugations";
import type { AdjSlot } from "@/lib/morphology/adjectives";

export const isAbbreviation = (properties: string) => /[0-9]\^/.test(properties);

/** Разбирает помету на отдельные разборы, каждый — плоским списком признаков. */
export const analyses = (properties: string): string[][] =>
    properties.split("|").map((analysis) => analysis.split(",").flatMap((tag) => tag.split("/")));

const CASES = ["nom", "gen", "acc", "dat", "ins", "loc", "voc"];
const capitalize = (word: string) => word[0].toUpperCase() + word.slice(1);

// --- существительные ---------------------------------------------------------

export const nounSlots = (tags: string[]): Slot[] => {
    const number = tags.includes("pl") ? "pl" : tags.includes("du") ? "du" : "sg";
    return tags.filter((tag) => CASES.includes(tag)).map((kase) => `${number}${capitalize(kase)}` as Slot);
};

// --- прилагательные, причастия, местоимения -----------------------------------

export interface AdjectiveReading {
    slots: AdjSlot[];
    /** Полная парадигма, краткая или обе — помета «plen/brev» встречается сплошь. */
    plen: boolean;
    brev: boolean;
}

export const adjectiveReading = (tags: string[]): AdjectiveReading => {
    const has = (tag: string) => tags.includes(tag);
    const number = has("pl") ? "pl" : has("du") ? "du" : "sg";
    const masculine = has("m");
    const neuter = has("n");
    const feminine = has("f");
    const slots: AdjSlot[] = [];
    const add = (slot: AdjSlot) => { if (!slots.includes(slot)) slots.push(slot); };

    if (number === "sg") {
        if (has("nom") && masculine) add("sgMNomAcc");
        if (has("acc") && masculine) { add("sgMAcc"); add("sgMNomAcc"); }
        if ((has("nom") || has("acc")) && neuter) add("sgNNomAcc");
        if (has("gen") && (masculine || neuter)) add("sgMNGen");
        if (has("dat") && (masculine || neuter)) add("sgMNDat");
        if (has("loc") && (masculine || neuter)) add("sgMNLoc");
        if (has("ins") && (masculine || neuter)) add("sgMNIns");
        if (has("voc")) add("sgMVoc");
        if (has("nom") && feminine) add("sgFNom");
        if (has("acc") && feminine) add("sgFAcc");
        if (has("gen") && feminine) add("sgFGen");
        if ((has("dat") || has("loc")) && feminine) add("sgFDatLoc");
        if (has("ins") && feminine) add("sgFIns");
    } else if (number === "pl") {
        if (has("nom") && masculine) add("plMNom");
        if (has("acc") && masculine) add("plMAccFNomAcc");
        if ((has("nom") || has("acc")) && feminine) add("plMAccFNomAcc");
        if ((has("nom") || has("acc")) && neuter) add("plNNomAcc");
        if (has("gen") || has("loc")) add("plGenLoc");
        if (has("dat")) add("plDat");
        if (has("ins")) add("plIns");
    } else {
        if ((has("nom") || has("acc")) && masculine) add("duMNomAcc");
        if ((has("nom") || has("acc")) && (neuter || feminine)) add("duNFNomAcc");
        if (has("gen") || has("loc")) add("duGenLoc");
        if (has("dat") || has("ins")) add("duDatIns");
    }

    // Без пометы «plen» или «brev» разбор относится к обеим парадигмам разом.
    return {
        slots,
        plen: has("plen") || !has("brev"),
        brev: has("brev") || !has("plen"),
    };
};

// --- глаголы ------------------------------------------------------------------

export const verbSlot = (tags: string[]): VerbSlot | null => {
    const has = (tag: string) => tags.includes(tag);
    const number = has("pl") ? "Pl" : has("du") ? "Du" : "Sg";
    const person = has("1p") ? "1" : has("2p") ? "2" : has("3p") ? "3" : "";

    if (has("inf")) return "inf";
    if (has("partcp")) {
        if (has("praet")) return has("pass") ? "partPastPass" : "partPastAct";
        if (has("perf")) return "partPerf";
        return has("pass") ? "partPresPass" : "partPresAct";
    }
    if (has("imper")) {
        if (number === "Pl") return person === "1" ? "impPl1" : "impPl2";
        if (number === "Du") return person === "1" ? "impDu1" : "impDu2";
        return "impSg23";
    }
    if (has("aor") || has("imperf")) {
        const mood = has("aor") ? "aor" : "imperf";
        if (number === "Sg") return `${mood}Sg${person === "1" ? "1" : "23"}` as VerbSlot;
        if (number === "Du") return `${mood}Du${person === "1" ? "1" : "23"}` as VerbSlot;
        return `${mood}Pl${person || "1"}` as VerbSlot;
    }
    if (has("praes") || has("fut")) {
        if (number === "Du") return person === "1" ? "presDu1" : "presDu23";
        return `pres${number}${person || "1"}` as VerbSlot;
    }
    return null;
};

// --- часть речи ---------------------------------------------------------------

export type PartOfSpeech = "noun" | "adjective" | "verb" | "other";

export const partOfSpeech = (properties: string): PartOfSpeech => {
    const first = properties.split(",")[0];
    if (first === "S") return "noun";
    if (first === "A" || first === "APRO" || first === "ANUM") return "adjective";
    if (first === "V") return "verb";
    return "other";
};

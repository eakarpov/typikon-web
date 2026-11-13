import { nameKey } from "@/lib/imeniny/core";
import { withInitialBreathing } from "./breathing";
export interface PersonalLexeme { name: string; search: string; scheme?: string | null; properties?: string | null }
// Дария is absent from the imported lexicon. Its feminine -иа paradigm is N3e,
// the same dictionary paradigm used by Маріа; explicit supplement, not a general guess.
export function supplementalPersonalLexeme(raw: string): PersonalLexeme | null {
    return ["дария", "дарья", "дариа"].includes(nameKey(raw))
        ? { name: "да́ріа", search: "дариа", scheme: "N3e", properties: "S,f,anim,persn" }
        : null;
}
export function feminineBaseKeys(raw: string): string[] {
    const key = nameKey(raw);
    return key.endsWith("ия") ? [key.slice(0, -2) + "ий"]
        : key.endsWith("а") ? [key.slice(0, -1)] : [];
}
/** Only an explicit female person may use a masculine dictionary stem. */
export function femininePersonalLexeme(raw: string, male: PersonalLexeme): PersonalLexeme | null {
    if (!male.properties?.split(",").includes("m") || !feminineBaseKeys(raw).includes(male.search)) return null;
    const soft = nameKey(raw).endsWith("ия");
    const name = soft ? male.name.replace(/[іиї]([\u0300-\u036f]*)й$/u, "і$1а") : male.name.replace(/[ъь]$/u, "") + "а";
    if (soft && name === male.name) return null;
    return { name, search: nameKey(raw), scheme: soft ? "N3e" : "N3t", properties: "S,f,anim,persn" };
}
export function cleanManualCase(raw: unknown): string | null {
    if (raw == null || raw === "") return null;
    if (typeof raw !== "string" || raw.trim().length > 60 || /[\u0000-\u001f<>]/u.test(raw)) throw new Error("Некорректная ручная форма имени (не более 60 знаков).");
    return raw.trim() || null;
}
export interface NameForms { text: string; genitive: string; dative?: string | null; source: "lexicon" | "accents" | "plain" | "manual"; hasParadigm?: boolean; lexeme?: string }
export async function applyManualCases(
    person: { manualGenitive?: string | null; manualDative?: string | null },
    form: NameForms,
    convert: (text: string) => Promise<string>,
): Promise<NameForms> {
    const hasParadigm = form.hasParadigm ?? form.source === "lexicon";
    if (hasParadigm) return { ...form, hasParadigm: true };
    const genitive = person.manualGenitive ? withInitialBreathing(await convert(person.manualGenitive)) : form.genitive;
    const dative = person.manualDative ? withInitialBreathing(await convert(person.manualDative)) : form.dative;
    return { ...form, genitive, dative, hasParadigm: false, source: person.manualGenitive ? "manual" : form.source };
}

/** A terminal stressed vowel may be removed by the generic stem table. */
export function personalCaseForm(lemma: string, form: string): string {
    let result = withInitialBreathing(form);
    if (/[аеёиоуыэюяіѵїєѣꙗѧѫѹꙋѡѻ][\u0300\u0301]$/iu.test(lemma) && !/[\u0300\u0301\u0311\u0342]/u.test(result)) {
        result = result.replace(/([аеёиоуыэюяіѵїєѣꙗѧѫѹꙋѡѻ])([^аеёиоуыэюяіѵїєѣꙗѧѫѹꙋѡѻ]*)$/iu, "$1\u0300$2");
    }
    return result;
}

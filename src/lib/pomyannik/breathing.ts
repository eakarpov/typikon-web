/** Normalize only Church Slavonic personal names, preserving stress. */
export const withInitialBreathing = (text: string): string => normalizeIzhitsa(text.replace(/ѷ/gu, "ѵ\u030f").replace(/Ѷ/gu, "Ѵ\u030f").replace(
    /(^|[\s\-–—(«])((?:ᲂу|Оу|оу)|[аеёиоуыэюяіѵїєѣꙗѧѫѹꙋѡѻѽ])([\u0300-\u036f\u0483-\u0489]*)/giu,
    (_, boundary: string, vowel: string, marks: string) =>
        boundary + (vowel === "е" ? "є" : vowel === "Е" ? "Є" : vowel) + (/[\u0485\u0486\u0313\u0314\u0343]/u.test(marks) ? "" : "\u0486") + marks,
).replace(/[іІїЇ]([\u0300-\u036f\u0483-\u0489]*)/gu, (match, marks: string) => {
    const upper = match[0] === "І" || match[0] === "Ї";
    return marks ? (upper ? "І" : "і") + marks : (upper ? "Ї" : "ї");
}));

/** In аѵ/еѵ the izhitsa is consonantal; accents/breathing identify vocalic exceptions. */
function normalizeIzhitsa(text: string): string {
    const expanded = text.replace(/ѷ/gu, "ѵ\u030f").replace(/Ѷ/gu, "Ѵ\u030f");
    return expanded.replace(/[ѵѴ]([\u0300-\u036f\u0483-\u0489]*)/gu, (match, marks: string, offset: number) => {
        const previous = expanded.slice(0, offset).replace(/[\u0300-\u036f\u0483-\u0489]+$/u, "").slice(-1);
        const vocalic = /[\u0300\u0301\u0311\u0313\u0314\u0342\u0343\u0485\u0486]/u.test(marks);
        const consonant = /[аеє]/iu.test(previous) && !vocalic;
        const cleaned = marks.replace(/[\u0308\u030f]/gu, "");
        return match[0] + cleaned + (!consonant && !vocalic ? "\u030f" : "");
    });
}

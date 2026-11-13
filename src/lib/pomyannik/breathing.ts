/** Normalize only Church Slavonic personal names, preserving stress. */
export const withInitialBreathing = (text: string): string => text.replace(
    /(^|[\s\-–—(«])((?:ᲂу|Оу|оу)|[аеёиоуыэюяіѵїєѣꙗѧѫѹꙋѡѻѽ])([\u0300-\u036f\u0483-\u0489]*)/giu,
    (_, boundary: string, vowel: string, marks: string) =>
        boundary + (vowel === "е" ? "є" : vowel === "Е" ? "Є" : vowel) + (/[\u0485\u0486\u0313\u0314\u0343]/u.test(marks) ? "" : "\u0486") + marks,
).replace(/[іІїЇ]([\u0300-\u036f\u0483-\u0489]*)/gu, (match, marks: string) => {
    const upper = match[0] === "І" || match[0] === "Ї";
    return marks ? (upper ? "І" : "і") + marks : (upper ? "Ї" : "ї");
}).replace(/[ѵѴ]([\u0300-\u036f\u0483-\u0489]*)/gu, (match, marks: string) => marks ? match : match + "\u030f");

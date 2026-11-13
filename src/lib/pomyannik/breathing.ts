/** Initial breathing only; neither spelling nor declension is inferred. */
export const withInitialBreathing = (text: string): string => text.replace(
    /(^|[\s\-–—(«])((?:ᲂу|Оу|оу)|[аеёиоуыэюяіѵїєѣꙗѧѫѹꙋѡѻѽ])([\u0300-\u036f\u0483-\u0489]*)/giu,
    (_, boundary: string, vowel: string, marks: string) =>
        boundary + vowel + (/[\u0485\u0486\u0313\u0314\u0343]/u.test(marks) ? "" : "\u0486") + marks,
);

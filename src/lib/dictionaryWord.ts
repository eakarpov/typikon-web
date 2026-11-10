/** Keep accents and Church Slavonic letters; remove only surrounding punctuation. */
export function dictionaryWord(value: string): string | null {
    const word = value.trim().replace(/^[^\p{L}\p{M}]+|[^\p{L}\p{M}]+$/gu, "");
    return word.length <= 80 && /^[\p{L}\p{M}]+(?:[-’'][\p{L}\p{M}]+)*$/u.test(word) ? word : null;
}

export function dictionaryHref(value: string): string | null {
    const word = dictionaryWord(value);
    return word ? `/dictionary?query=${encodeURIComponent(word)}` : null;
}

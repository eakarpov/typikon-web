/** Compile authoring-only tags to the numbered format understood by every reader. */
export function compileInlineFootnotes(content: string, poems: string, existing: string[]) {
    if (!Array.isArray(existing) || existing.some(note => typeof note !== "string")) {
        throw new Error("Список сносок должен содержать строки");
    }
    // Never reorder or remove legacy notes: other fields and old links use their numbers.
    const footnotes = [...existing];
    for (const field of (content.includes("{fn|") || poems.includes("{fn|")) ? [content, poems] : []) {
        for (const match of field.matchAll(/\{(\d+)\}/g)) {
            if (Number(match[1]) < 1 || Number(match[1]) > existing.length) {
                throw new Error(`Сноска {${match[1]}} отсутствует в списке сносок`);
            }
        }
    }
    const compile = (field: string) => {
        const result = field.replace(/\{fn\|([^{}]*)\}/g, (_, body: string) => {
            const note = body.trim();
            if (!note) throw new Error("Текст новой сноски не может быть пустым");
            let index = footnotes.indexOf(note);
            if (index < 0) { index = footnotes.length; footnotes.push(note); }
            return `{${index + 1}}`;
        });
        if (result.includes("{fn|")) throw new Error("Незакрытая сноска или фигурные скобки внутри {fn|…}");
        return result;
    };
    return { content: compile(content), poems: compile(poems), footnotes };
}

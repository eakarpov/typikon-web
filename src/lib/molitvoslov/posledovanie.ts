import type { PrayerGender } from "@/lib/molitvoslov/named";

// СБОРКА СТРОК ПОСЛЕДОВАНИЯ — чистая функция над тем, что приехало из rulesDb.
//
// Строка последования — либо текст (молитва, песнопение, псалом), либо
// указание книги («Прочесть трижды», «Крестное знамение и поясной поклон»).
// В базе указание — тем же рядом occurrences с kind='rubric', и смешано с
// текстами в порядке печати. Наружу указание уходит полем `note`, а не
// текстом: прочесть его как молитву — значит поклониться словам составителя.

export interface PosledovanieRowInput {
    id: string;
    seq: number;
    /** Заголовок места, как его назвала книга («Молитва мытаря»). */
    label: string | null;
    /** Зачин, снятый с текста («Возглас», «Слава, и ныне»). */
    lead: string | null;
    repeatCount: number | null;
    poklon: string | null;
    /** 'text' — молитва; 'rubric' — указание; иное — как текст. */
    kind: string;
    text: string;
    /** Женский вариант той же строки, если издание его печатает. */
    textF: string | null;
}

export interface BuiltPosledovanieRow {
    label: string | null;
    lead: string | null;
    repeatCount: number | null;
    poklon: string | null;
    note: string | null;
    text: string | null;
}

export const buildPosledovanieRows = (
    rows: PosledovanieRowInput[],
    gender: PrayerGender,
): BuiltPosledovanieRow[] =>
    rows
        .slice()
        .sort((a, b) => a.seq - b.seq)
        .map((row) => {
            const rubric = row.kind === "rubric";
            // Женский вариант — свойство чтения, а не другого последования:
            // место одно, текста два. Варианта нет — читается общий текст.
            const text = gender === "f" && row.textF ? row.textF : row.text;
            return {
                label: row.label ?? null,
                lead: row.lead ?? null,
                repeatCount: row.repeatCount ?? null,
                poklon: row.poklon ?? null,
                note: rubric ? text : null,
                text: rubric ? null : text,
            };
        });

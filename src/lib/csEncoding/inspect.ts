import { charInfo, type CharInfo } from "@/lib/csEncoding/chars";
import { mixedScript } from "@/lib/podobny/core";

// Разбор строки по знакам: что в ней на самом деле стоит.
//
// Разбираем КЛАСТЕРАМИ — буква со всем, что над нею, — а не знаками подряд.
// Читатель видит именно кластер («гдⷭ҇ь» для него четыре буквы, а не семь
// знаков), и все интересные беды — это беды порядка ВНУТРИ кластера: ударение,
// повисшее перед буквой; титло, набранное перед ударением; выносная без
// покрытия. Разбор по одному знаку такие пары просто не заметил бы.

/** Надстрочное: всё, что цепляется к предыдущей букве. */
const COMBINING = /[̀-ͯ҃-҉ⷠ-ⷿ꙯ꙴ-꙽᷀-᷿]/;

export type ClusterFlag =
    | "mark-before-base"
    | "accent-after-titlo"
    | "superscript-no-pokrytie"
    | "two-accents"
    | "latin-in-word"
    | "nfc-differs"
    | "private-use";

export const FLAG_LABELS: Record<ClusterFlag, string> = {
    "mark-before-base": "знак впереди буквы",
    "accent-after-titlo": "ударение после титла",
    "superscript-no-pokrytie": "выносная без покрытия",
    "two-accents": "два ударения",
    "latin-in-word": "чужая буква",
    "nfc-differs": "не сложено",
    "private-use": "знак из частной области",
};

export const FLAG_NOTES: Record<ClusterFlag, string> = {
    "mark-before-base": "надстрочный знак стоит раньше своей буквы — он повиснет над "
        + "предыдущей или сам по себе. Чаще всего это след перекодировки.",
    "accent-after-titlo": "титло набрано перед ударением. В книгах так не печатают: это "
        + "паразитное титло, и при ввозе в собрание мы его снимаем — здесь только показываем.",
    "superscript-no-pokrytie": "после выносной буквы обычно стоит покрытие (U+0487): в "
        + "собрании «гдⷭ҇ь», а не «гдⷭь». Это не ошибка набора, а разночтение изданий.",
    "two-accents": "на одной букве два ударения — так не бывает; одно из них лишнее.",
    "latin-in-word": "внутри кириллического слова стоит латинская буква. Глазом их не "
        + "отличить, а поиск такое слово не найдёт.",
    "nfc-differs": "знак записан разложенно и при нормализации сложится в один. Пока не "
        + "сложен, одно и то же слово лежит в двух видах и не сходится само с собою.",
    "private-use": "знак из области частного использования: он ничего не значит вне того "
        + "шрифта, которым набирался. Обычно это след старой перекодировки.",
};

export interface CharCell extends CharInfo {
    char: string;
}

export interface Cluster {
    text: string;
    base: CharCell;
    marks: CharCell[];
    flags: ClusterFlag[];
}

const cell = (ch: string): CharCell => ({ char: ch, ...charInfo(ch.codePointAt(0)!) });

/** Разбор строки на кластеры с пометами. */
export const inspect = (text: string): {
    clusters: Cluster[];
    summary: Array<{ flag: ClusterFlag; count: number }>;
} => {
    const chars = [...text];
    const clusters: Cluster[] = [];

    for (let i = 0; i < chars.length; i++) {
        const ch = chars[i];
        const marks: CharCell[] = [];
        // Надстрочный без буквы перед ним — сам себе кластер: так и покажем,
        // потому что именно так его и увидит читатель.
        if (!COMBINING.test(ch)) {
            while (i + 1 < chars.length && COMBINING.test(chars[i + 1])) {
                marks.push(cell(chars[++i]));
            }
        }
        clusters.push({ text: ch + marks.map((m) => m.char).join(""), base: cell(ch), marks, flags: [] });
    }

    // Слова — для приметы о чужой букве: одна латинская буква посреди
    // кириллического слова видна только в слове целиком.
    const latinWords = new Set<string>();
    for (const word of text.split(/[^\p{L}\p{M}]+/u)) {
        if (word && mixedScript(word)) latinWords.add(word);
    }
    const latinChars = new Set<string>();
    for (const word of latinWords) {
        for (const ch of word) if (/[A-Za-z]/.test(ch)) latinChars.add(ch);
    }

    for (const cluster of clusters) {
        const { base, marks } = cluster;

        if (base.klass === "accent" || base.klass === "titlo" || base.klass === "spirit"
            || base.klass === "superscript" || base.klass === "pokrytie" || base.klass === "mark") {
            cluster.flags.push("mark-before-base");
        }
        if (base.klass === "private" || marks.some((m) => m.klass === "private")) {
            cluster.flags.push("private-use");
        }
        if (marks.filter((m) => m.klass === "accent").length > 1) cluster.flags.push("two-accents");

        const titlo = marks.findIndex((m) => m.klass === "titlo");
        const accent = marks.findIndex((m) => m.klass === "accent");
        if (titlo >= 0 && accent > titlo) cluster.flags.push("accent-after-titlo");

        const superscript = marks.findIndex((m) => m.klass === "superscript");
        if (superscript >= 0 && !marks.some((m) => m.klass === "pokrytie")) {
            cluster.flags.push("superscript-no-pokrytie");
        }
        if (latinChars.has(base.char)) cluster.flags.push("latin-in-word");
        if (cluster.text !== cluster.text.normalize("NFC")) cluster.flags.push("nfc-differs");
    }

    const counts = new Map<ClusterFlag, number>();
    for (const cluster of clusters) {
        for (const flag of cluster.flags) counts.set(flag, (counts.get(flag) ?? 0) + 1);
    }

    return {
        clusters,
        summary: [...counts.entries()]
            .map(([flag, count]) => ({ flag, count }))
            .sort((a, b) => b.count - a.count),
    };
};

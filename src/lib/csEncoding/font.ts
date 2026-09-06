// Чтение шрифтового файла: что в нём объявлено, а не что нарисовалось.
//
// ЗАЧЕМ СВОЙ РАЗБОР. Ответы на вопросы «покрывает ли шрифт выносные», «умеет ли
// он ставить надстрочный знак над буквой», «юникодный он или дореформенный»
// сегодня добываются консольными средствами — fontTools, otfinfo, hb-shape,
// codechart из cslavonic (тот ради кодовой таблицы гоняет XeLaTeX). Всё нужное
// лежит в самом файле, и браузер читает его не хуже.
//
// ЧЕМ ЭТО ОТЛИЧАЕТСЯ ОТ ПРОВЕРКИ ШРИФТА У ЧИТАТЕЛЯ (/nabor/shrift). Там мы
// измеряем, что нарисовал браузер в системе читателя, — приметами, каждая из
// которых по-своему врёт. Здесь читается объявленное самим файлом, и ответ
// точен: знак либо есть в таблице соответствий, либо его там нет.
//
// РАЗБИРАЕТСЯ НЕ ВСЁ. Нам нужны четыре таблицы из двух десятков: `name` (чей
// шрифт и на каких условиях), `cmap` (что во что отображается), `post` (имена
// глифов — по ним читаются частные коды) и `GPOS`/`GSUB` (умеет ли шрифт
// прикреплять надстрочные и что объявляет из возможностей). Очертания глифов не
// трогаем вовсе: рисунок здесь не нужен.

export interface CmapChoice {
    platform: number;
    encoding: number;
    format: number;
    /** По-русски: чем эта таблица является. */
    label: string;
    /** Дореформенная раскладка: отображение по байтам, а не по юникоду. */
    legacy: boolean;
}

export interface FontInfo {
    format: "truetype" | "cff" | "collection" | "unknown";
    names: {
        family?: string;
        subfamily?: string;
        version?: string;
        designer?: string;
        license?: string;
        licenseUrl?: string;
    };
    /** Выбранная таблица соответствий и все найденные — для суждения о шрифте. */
    cmap: CmapChoice | null;
    cmaps: CmapChoice[];
    /** Код знака → номер глифа. */
    codepoints: Map<number, number>;
    /** Номер глифа → имя, если шрифт их называет. */
    glyphNames: Map<number, string>;
    glyphCount: number;
    layout: {
        gpos: boolean;
        /** Прикрепление надстрочного знака к букве (lookup 4). */
        markToBase: boolean;
        /** Прикрепление знака к знаку (lookup 6): ударение поверх звательца. */
        markToMark: boolean;
        gsub: boolean;
        features: string[];
    };
}

const TAG = (view: DataView, offset: number) =>
    String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1),
        view.getUint8(offset + 2), view.getUint8(offset + 3));

// Стандартные имена глифов Macintosh: первые 258 номеров таблицы `post`
// отсылают сюда. Нам из них важна только заглушка .notdef — прочие имена
// латинские и к церковнославянскому отношения не имеют, но нумерацию сдвигают.
const MAC_GLYPHS = 258;

const decodeName = (view: DataView, offset: number, length: number, platform: number): string => {
    const bytes = new Uint8Array(view.buffer, view.byteOffset + offset, length);
    // Платформа 3 (Windows) пишет имена UTF-16BE, платформа 1 (Mac) — однобайтно.
    if (platform === 3 || platform === 0) {
        let out = "";
        for (let i = 0; i + 1 < bytes.length; i += 2) out += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
        return out;
    }
    return new TextDecoder("windows-1252").decode(bytes);
};

const NAME_IDS: Record<number, keyof FontInfo["names"]> = {
    1: "family", 2: "subfamily", 5: "version", 9: "designer", 13: "license", 14: "licenseUrl",
};

const readNames = (view: DataView, offset: number): FontInfo["names"] => {
    const names: FontInfo["names"] = {};
    const count = view.getUint16(offset + 2);
    const strings = offset + view.getUint16(offset + 4);
    for (let i = 0; i < count; i++) {
        const rec = offset + 6 + i * 12;
        const platform = view.getUint16(rec);
        const nameId = view.getUint16(rec + 6);
        const key = NAME_IDS[nameId];
        if (!key || names[key]) continue;
        const length = view.getUint16(rec + 8);
        const stringOffset = strings + view.getUint16(rec + 10);
        if (stringOffset + length > view.byteLength) continue;
        names[key] = decodeName(view, stringOffset, length, platform).trim();
    }
    return names;
};

// Что за таблица соответствий перед нами. Пара «платформа/кодировка» и говорит,
// юникодный шрифт или дореформенный: (3,1) и (3,10) — юникод, (3,0) — «символьная»
// раскладка, где знаки лежат по байтам в области частного использования, (1,0) —
// однобайтная маковская. Дореформенные церковнославянские шрифты — как раз две
// последние: буква там не буква, а место в раскладке.
const describeCmap = (platform: number, encoding: number, format: number): CmapChoice => {
    if (platform === 3 && encoding === 10) {
        return { platform, encoding, format, label: "юникод, все плоскости", legacy: false };
    }
    if (platform === 3 && encoding === 1) {
        return { platform, encoding, format, label: "юникод, основная плоскость", legacy: false };
    }
    if (platform === 0) {
        return { platform, encoding, format, label: "юникод", legacy: false };
    }
    if (platform === 3 && encoding === 0) {
        return { platform, encoding, format, label: "символьная раскладка Windows (байты в частной области)", legacy: true };
    }
    if (platform === 1) {
        return { platform, encoding, format, label: "однобайтная раскладка Macintosh", legacy: true };
    }
    return { platform, encoding, format, label: `платформа ${platform}, кодировка ${encoding}`, legacy: true };
};

const readCmapSubtable = (view: DataView, offset: number, into: Map<number, number>) => {
    const format = view.getUint16(offset);
    if (format === 0) {
        for (let b = 0; b < 256; b++) {
            const gid = view.getUint8(offset + 6 + b);
            if (gid) into.set(b, gid);
        }
    } else if (format === 4) {
        const segX2 = view.getUint16(offset + 6);
        const ends = offset + 14;
        const starts = ends + segX2 + 2;
        const deltas = starts + segX2;
        const ranges = deltas + segX2;
        for (let s = 0; s < segX2 / 2; s++) {
            const end = view.getUint16(ends + s * 2);
            const start = view.getUint16(starts + s * 2);
            const delta = view.getInt16(deltas + s * 2);
            const rangeOffset = view.getUint16(ranges + s * 2);
            if (start > end) continue;
            for (let cp = start; cp <= end && cp !== 0xffff; cp++) {
                let gid: number;
                if (rangeOffset === 0) {
                    gid = (cp + delta) & 0xffff;
                } else {
                    const at = ranges + s * 2 + rangeOffset + (cp - start) * 2;
                    if (at + 1 >= view.byteLength) continue;
                    gid = view.getUint16(at);
                    if (gid) gid = (gid + delta) & 0xffff;
                }
                if (gid) into.set(cp, gid);
            }
        }
    } else if (format === 6) {
        const first = view.getUint16(offset + 6);
        const count = view.getUint16(offset + 8);
        for (let i = 0; i < count; i++) {
            const gid = view.getUint16(offset + 10 + i * 2);
            if (gid) into.set(first + i, gid);
        }
    } else if (format === 12) {
        const groups = view.getUint32(offset + 12);
        for (let g = 0; g < groups; g++) {
            const at = offset + 16 + g * 12;
            const start = view.getUint32(at);
            const end = view.getUint32(at + 4);
            const gid = view.getUint32(at + 8);
            // Заслон от испорченного файла: сплошной диапазон на миллион знаков
            // в шрифте не встречается, а память съест.
            for (let cp = start; cp <= Math.min(end, start + 0xffff); cp++) into.set(cp, gid + (cp - start));
        }
    }
};

const readPost = (view: DataView, offset: number, length: number): Map<number, string> => {
    const names = new Map<number, string>();
    if (view.getUint32(offset) !== 0x00020000) return names;
    const count = view.getUint16(offset + 32);
    const indices: number[] = [];
    for (let i = 0; i < count; i++) indices.push(view.getUint16(offset + 34 + i * 2));
    const extra: string[] = [];
    let at = offset + 34 + count * 2;
    while (at < offset + length && at < view.byteLength) {
        const len = view.getUint8(at);
        let s = "";
        for (let i = 1; i <= len; i++) s += String.fromCharCode(view.getUint8(at + i));
        extra.push(s);
        at += len + 1;
    }
    indices.forEach((index, gid) => {
        if (index >= MAC_GLYPHS && index - MAC_GLYPHS < extra.length) names.set(gid, extra[index - MAC_GLYPHS]);
    });
    return names;
};

// GPOS: нас интересует не разметка целиком, а два вопроса — прикрепляет ли шрифт
// знак к букве (lookup 4) и знак к знаку (lookup 6). Без первого надстрочный знак
// встаёт отдельной литерой, и слово рассыпается; это и есть разница между
// церковнославянским шрифтом и обычным, у которого нужные глифы случайно нашлись.
const readLayout = (view: DataView, gpos?: number, gsub?: number): FontInfo["layout"] => {
    const features = new Set<string>();
    let markToBase = false;
    let markToMark = false;

    const scan = (offset: number, wantMarks: boolean) => {
        const featureList = offset + view.getUint16(offset + 6);
        const featureCount = view.getUint16(featureList);
        for (let i = 0; i < featureCount; i++) features.add(TAG(view, featureList + 2 + i * 6));
        if (!wantMarks) return;

        const lookupList = offset + view.getUint16(offset + 8);
        const lookupCount = view.getUint16(lookupList);
        for (let i = 0; i < lookupCount; i++) {
            const lookup = lookupList + view.getUint16(lookupList + 2 + i * 2);
            let type = view.getUint16(lookup);
            // Тип 9 — обёртка над другим типом (расширение для больших таблиц);
            // разворачиваем один раз, глубже вложенности не бывает.
            if (type === 9) {
                const subtable = lookup + view.getUint16(lookup + 6);
                type = view.getUint16(subtable + 2);
            }
            if (type === 4) markToBase = true;
            if (type === 6) markToMark = true;
        }
    };

    if (gpos !== undefined) scan(gpos, true);
    if (gsub !== undefined) scan(gsub, false);

    return {
        gpos: gpos !== undefined,
        markToBase,
        markToMark,
        gsub: gsub !== undefined,
        features: [...features].sort(),
    };
};

/** Разбор шрифтового файла. Бросает, если это не шрифт. */
export const readFont = (data: ArrayBuffer): FontInfo => {
    const view = new DataView(data);
    if (data.byteLength < 12) throw new Error("Файл слишком мал для шрифта.");

    const tag = TAG(view, 0);
    const format: FontInfo["format"] =
        tag === "OTTO" ? "cff"
            : tag === "ttcf" ? "collection"
                : (view.getUint32(0) === 0x00010000 || tag === "true") ? "truetype" : "unknown";
    if (format === "collection") {
        throw new Error("Это собрание шрифтов (.ttc): разберите один шрифт за раз.");
    }
    if (format === "unknown") {
        throw new Error("Не похоже на шрифт: подписи sfnt в начале файла нет.");
    }

    const tables = new Map<string, { offset: number; length: number }>();
    const count = view.getUint16(4);
    for (let i = 0; i < count; i++) {
        const at = 12 + i * 16;
        tables.set(TAG(view, at), { offset: view.getUint32(at + 8), length: view.getUint32(at + 12) });
    }

    const cmapTable = tables.get("cmap");
    const codepoints = new Map<number, number>();
    const cmaps: CmapChoice[] = [];
    let chosen: CmapChoice | null = null;

    if (cmapTable) {
        const base = cmapTable.offset;
        const records = view.getUint16(base + 2);
        let bestScore = -1;
        let bestOffset = -1;
        for (let i = 0; i < records; i++) {
            const at = base + 4 + i * 8;
            const platform = view.getUint16(at);
            const encoding = view.getUint16(at + 2);
            const offset = base + view.getUint32(at + 4);
            if (offset + 4 > view.byteLength) continue;
            const subFormat = view.getUint16(offset);
            const described = describeCmap(platform, encoding, subFormat);
            cmaps.push(described);
            // Юникодные таблицы предпочтительнее; из них — та, что покрывает
            // дополнительные плоскости.
            const score = described.legacy ? (platform === 3 ? 1 : 0) : (subFormat === 12 ? 4 : 3);
            if (score > bestScore) { bestScore = score; bestOffset = offset; chosen = described; }
        }
        if (bestOffset >= 0) readCmapSubtable(view, bestOffset, codepoints);
    }

    const postTable = tables.get("post");
    const glyphNames = postTable ? readPost(view, postTable.offset, postTable.length) : new Map<number, string>();
    const maxp = tables.get("maxp");

    return {
        format,
        names: tables.has("name") ? readNames(view, tables.get("name")!.offset) : {},
        cmap: chosen,
        cmaps,
        codepoints,
        glyphNames,
        glyphCount: maxp ? view.getUint16(maxp.offset + 4) : 0,
        layout: readLayout(view, tables.get("GPOS")?.offset, tables.get("GSUB")?.offset),
    };
};

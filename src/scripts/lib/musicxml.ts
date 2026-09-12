// Чтение партитур MusicXML — того, что отдаёт Sibelius, — для снятия напевов.
//
// Разбор XML свой, а не библиотечный: из всего MusicXML нужны такт, нота,
// сдвиг назад (backup) и подтекстовка, и тянуть ради этого зависимость незачем.
// Рассчитан он на правильно сформированные файлы без пространств имён и без
// внутреннего подмножества DOCTYPE — именно такие Sibelius и пишет. Встретив
// незакрытый тег, разбор падает, а не угадывает.
//
// Партитура обихода устроена так, что ТАКТ — ЭТО КОЛЕНО, поэтому всё здесь
// собирается по тактам. Подтекстовка висит на одном голосе (у Sibelius —
// на альте), а ноты остальных голосов относятся к слогу по времени начала:
// нота принадлежит тому слогу, во время которого она началась.

import fs from "fs";

export interface XmlNode {
    name: string;
    attrs: Record<string, string>;
    children: XmlNode[];
    text: string;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'" };

const decode = (s: string) =>
    s.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (whole, body: string) => {
        if (/^#[xX]/.test(body)) return String.fromCodePoint(parseInt(body.slice(2), 16));
        if (body.startsWith("#")) return String.fromCodePoint(parseInt(body.slice(1), 10));
        return ENTITIES[body] ?? whole;
    });

const TOKEN = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<!\[CDATA\[([\s\S]*?)\]\]>|<\/([^\s>]+)\s*>|<([^\s/>!?]+)([^>]*?)(\/?)>|([^<]+)/g;
const ATTR = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

export const parseXml = (source: string): XmlNode => {
    const root: XmlNode = { name: "#document", attrs: {}, children: [], text: "" };
    const stack = [root];
    for (const [, cdata, closing, opening, rawAttrs, selfClosing, text] of source.matchAll(TOKEN)) {
        const top = stack[stack.length - 1];
        if (cdata !== undefined) {
            top.text += cdata;
        } else if (closing) {
            if (top.name !== closing) throw new Error(`MusicXML: </${closing}> закрывает <${top.name}>`);
            stack.pop();
        } else if (opening) {
            const attrs: Record<string, string> = {};
            for (const [, name, double, single] of rawAttrs.matchAll(ATTR)) attrs[name] = decode(double ?? single);
            const node: XmlNode = { name: opening, attrs, children: [], text: "" };
            top.children.push(node);
            if (!selfClosing) stack.push(node);
        } else if (text !== undefined) {
            top.text += decode(text);
        }
    }
    if (stack.length !== 1) throw new Error(`MusicXML: не закрыт <${stack[stack.length - 1].name}>`);
    return root;
};

const child = (node: XmlNode | undefined, name: string) => node?.children.find(c => c.name === name);
const at = (node: XmlNode | undefined, route: string) =>
    route.split("/").reduce<XmlNode | undefined>((n, name) => child(n, name), node);
const numberAt = (node: XmlNode | undefined, route: string) => {
    const found = at(node, route);
    return found ? parseFloat(found.text) : undefined;
};

const SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const KEY_NAMES: Record<number, string> = { 0: "C", 1: "G", 2: "D", 3: "A", 4: "E", [-1]: "F", [-2]: "Bb", [-3]: "Eb", [-4]: "Ab" };
const ACCIDENTALS: Record<number, string> = { 1: "^", [-1]: "_", 0: "=", 2: "^^", [-2]: "__" };

/** Какие ступени ключ повышает или понижает. */
const keyAlters = (fifths: number): Record<string, number> => {
    const out: Record<string, number> = {};
    if (fifths > 0) for (const step of "FCGDAEB".slice(0, fifths)) out[step] = 1;
    else for (const step of "BEADGCF".slice(0, -fifths)) out[step] = -1;
    return out;
};

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));

/**
 * Нота в ABC — как её пишут данные напевов (src/data/tunes).
 *
 * Знак ставится только там, где его не подразумевает ключ: фа-диез в соль
 * мажоре пишется «F». Единица длительности — четверть: «B2» половинная,
 * «D1/2» восьмая.
 */
export const abcNote = (step: string, octave: number, alter: number, fifths: number, units: number, divisions: number): string => {
    const implied = keyAlters(fifths)[step] ?? 0;
    const sign = alter !== implied ? ACCIDENTALS[alter] : "";
    const letter = octave >= 5 ? step.toLowerCase() + "'".repeat(octave - 5) : step + ",".repeat(4 - octave);
    const g = gcd(units, divisions) || 1;
    const num = units / g, den = divisions / g;
    const length = num === den ? "" : den === 1 ? String(num) : `${num}/${den}`;
    return sign + letter + length;
};

export interface ScoreNote {
    /** Начало от начала такта, в четвертях. */
    onset: number;
    duration: number;
    /** Нота в ABC; у паузы её нет. */
    abc?: string;
    midi?: number;
    lyric?: { text: string; syllabic: string | null };
}

/** Один голос одной партии: у Sibelius на стане два голоса. */
export interface ScoreStream {
    part: number;
    voice: string;
    measures: Map<number, ScoreNote[]>;
}

export interface Score {
    title: string;
    creator: string;
    /** Ключ по последнему объявлению: «G», «F». */
    key: string;
    /** По партии, внутри — по номеру голоса. */
    streams: ScoreStream[];
}

export const readScore = (source: string): Score => {
    const root = child(parseXml(source), "score-partwise");
    if (!root) throw new Error("MusicXML: ожидался score-partwise");

    const streams = new Map<string, ScoreStream>();
    let fifths = 0;

    root.children.filter(c => c.name === "part").forEach((part, pi) => {
        let divisions = 1;
        for (const measure of part.children.filter(c => c.name === "measure")) {
            const number = parseInt(measure.attrs.number, 10);
            divisions = numberAt(measure, "attributes/divisions") ?? divisions;
            fifths = numberAt(measure, "attributes/key/fifths") ?? fifths;

            // Позиция одна на такт, а не на голос: второй голос начинается
            // сдвигом назад (backup) на длину первого.
            let pos = 0;
            for (const el of measure.children) {
                if (el.name === "backup") { pos -= (numberAt(el, "duration") ?? 0) / divisions; continue; }
                if (el.name === "forward") { pos += (numberAt(el, "duration") ?? 0) / divisions; continue; }
                // Нота аккорда звучит с предыдущей: для напева важен верхний
                // звук голоса, и позиция на ней не сдвигается.
                if (el.name !== "note" || child(el, "chord")) continue;

                const units = numberAt(el, "duration") ?? 0;
                const voice = at(el, "voice")?.text.trim() ?? "1";
                const note: ScoreNote = { onset: pos, duration: units / divisions };

                const pitch = child(el, "pitch");
                if (!child(el, "rest") && pitch) {
                    const step = at(pitch, "step")!.text.trim();
                    const octave = numberAt(pitch, "octave")!;
                    const alter = Math.trunc(numberAt(pitch, "alter") ?? 0);
                    note.abc = abcNote(step, octave, alter, fifths, units, divisions);
                    note.midi = (octave + 1) * 12 + SEMITONES[step] + alter;
                }
                const lyric = child(el, "lyric");
                const text = child(lyric, "text");
                if (text) note.lyric = { text: text.text, syllabic: at(lyric, "syllabic")?.text.trim() ?? null };

                const id = `${pi}:${voice}`;
                if (!streams.has(id)) streams.set(id, { part: pi, voice, measures: new Map() });
                const own = streams.get(id)!.measures;
                if (!own.has(number)) own.set(number, []);
                own.get(number)!.push(note);
                pos += note.duration;
            }
        }
    });

    return {
        title: at(root, "work/work-title")?.text ?? "",
        creator: (at(root, "identification/creator")?.text ?? "").replace(/\n/g, " "),
        key: KEY_NAMES[fifths] ?? String(fifths),
        streams: [...streams.values()].sort((a, b) =>
            a.part - b.part || (a.voice < b.voice ? -1 : a.voice > b.voice ? 1 : 0)),
    };
};

export interface ScoreSyllable {
    /** Как подписано в партитуре: бывает, что под одной нотой несколько слов. */
    text: string;
    syllabic: string | null;
    onset: number;
    offset: number;
    /** Ноты каждого голоса, начавшиеся на этом слоге, в ABC подряд. */
    voices: Record<string, string>;
    sopranoMidi: number[];
}

export interface ScoreMeasure {
    number: number;
    syllables: ScoreSyllable[];
}

export interface ScoreTable {
    title: string;
    creator: string;
    key: string;
    /** Имена голосов по порядку: S, A, T, B, дальше лишние. */
    voices: string[];
    measures: ScoreMeasure[];
}

const EPS = 1e-9;

/** Партитура, разложенная по слогам подтекстовки. */
export const syllableTable = (score: Score): ScoreTable => {
    const { streams } = score;
    const names = streams.map((s, i) => ["S", "A", "T", "B"][i] ?? `X${s.part}${s.voice}`);
    const lyricCount = (s: ScoreStream) => [...s.measures.values()].flat().filter(n => n.lyric).length;
    const carrier = streams.reduce((best, s) => (lyricCount(s) > lyricCount(best) ? s : best), streams[0]);

    const measures = [...carrier.measures.keys()].sort((a, b) => a - b).map(number => {
        const notes = carrier.measures.get(number)!;
        const end = notes.reduce((sum, n) => sum + n.duration, 0);
        const sung = notes.filter(n => n.lyric);
        const syllables = sung.map((n, i): ScoreSyllable => {
            const onset = n.onset;
            const offset = i + 1 < sung.length ? sung[i + 1].onset : end;
            const voices: Record<string, string> = {};
            let sopranoMidi: number[] = [];
            streams.forEach((stream, vi) => {
                const own = (stream.measures.get(number) ?? [])
                    .filter(x => x.abc && x.onset >= onset - EPS && x.onset < offset - EPS);
                voices[names[vi]] = own.map(x => x.abc).join("");
                if (vi === 0) sopranoMidi = own.map(x => x.midi!);
            });
            return { text: n.lyric!.text, syllabic: n.lyric!.syllabic, onset, offset, voices, sopranoMidi };
        });
        return { number, syllables };
    });

    return { title: score.title, creator: score.creator, key: score.key, voices: names, measures };
};

export const readScoreFile = (file: string): ScoreTable =>
    syllableTable(readScore(fs.readFileSync(file, "utf8")));

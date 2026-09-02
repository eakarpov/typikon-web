// Линейная запись: собираем ABC — текстовую нотацию, которую abcjs рисует
// станом и умеет проигрывать.
//
// ABC выбран не за распространённость, а за то, что он ТЕКСТ: напев, собранный
// по слогам, остаётся строкой, которую можно сверить глазами, положить в тест и
// сравнить построчно в git. Через MusicXML или прямые вызовы рисующей
// библиотеки то же самое стало бы деревом объектов, сверять которое нечем.
//
// Размера у распева нет — M:none. Обиход поётся по тексту, а не по тактам, и
// навязанный размер расставил бы такты там, где их не поют, разбив колено
// посередине. Такт здесь один — колено, и разделяет их черта в конце строки.

import type { Fitted } from "../apply";
import type { Score } from "../types";
import { cellContent, contentFor } from "./content";
import { VOICE_LABELS, type Voice } from "../types";

/**
 * Станы партитуры и голоса на них.
 *
 * Партесный обиход печатается НА ДВУХ СТАНАХ, а не на четырёх: дискант с
 * альтом на скрипичном, тенор с басом на басовом. Так его набирают все обиходы,
 * и так его читают на клиросе — четыре отдельных стана заставили бы певчего
 * искать свою строку глазами по всей странице.
 *
 * Порядок здесь же и задаёт порядок голосов сверху вниз.
 */
const STAVES: Voice[][] = [["soprano", "alt"], ["tenor", "bas"], ["edinoglas"]];

const STAFF_CLEF: Record<string, string> = {
    "soprano": "treble", "alt": "treble",
    "tenor": "bass", "bas": "bass",
    "edinoglas": "treble",
};

/** Подпись стана слева. Ставится при первом его голосе: вторая затёрла бы первую. */
const staffName = (voices: Voice[]) => voices.map(v => VOICE_LABELS[v]).join(", ");

// Нота в записи ABC: необязательный знак альтерации, буква, октавные запятые
// или апострофы, длительность. По ней считается, сколько нот в шаге.
const ABC_NOTE = /[_^=]*[A-Ga-gz][,']*\d*(?:\/\d*)?/g;

export const countNotes = (abc: string): number => (abc.match(ABC_NOTE) ?? []).length;

/**
 * Подтекстовка колена для строки w:.
 *
 * Слоги одного слова связываются дефисом, слова разделяются пробелом — ровно
 * так ABC и понимает подтекстовку. Границы слов восстанавливаются по пометке
 * wordStart: делением на слоги они стёрты, а без них «Го спо ди» встало бы под
 * нотами тремя отдельными словами.
 *
 * РАСПЕВ ТРЕБУЕТ ПОДЧЁРКИВАНИЙ, и без них подтекстовка съезжает. ABC кладёт по
 * слогу НА НОТУ, а не на шаг напева: шаг с распевом несёт две-три ноты, и
 * лишние ноты утаскивали бы под себя следующие слоги. Отсюда «Спа-се-е» вместо
 * «Спа-а-се» и «Хри-сте-е» вместо «Хри-и-сте»: съезжало всё, что стояло после
 * первого же распева в колене. Подчёркивание держит слог на лишней ноте.
 */
const lyricsOf = (cells: { text: string; wordStart: boolean; notes: number }[]): string =>
    cells
        .map((cell, i) => {
            const head = i === 0 ? "" : cell.wordStart ? " " : "-";
            return head + cell.text + " _".repeat(Math.max(0, cell.notes - 1));
        })
        .join("");

/**
 * Растянутые шаги, в которых стои́т не одна нота.
 *
 * Растягиваться — то есть звучать ещё раз на лишнем слоге — имеет право только
 * читок: он для того и заведён, и в нём одна нота. Всякий другой шаг, которому
 * достался лишний слог, повторяет своё содержание целиком, а в нём может
 * стоять распев из четырёх нот. Именно так удваивался конечный распев тропаря:
 * «Су́-ще-му» получали по распеву каждый.
 *
 * Проверка живёт здесь, а не в раскладке: сколько нот в шаге, знает запись, а
 * раскладка нотации не знает и знать не должна — она одна на крюки и на ноты.
 */
export const stretchIssues = (fitted: Fitted, score: Score): string[] => {
    const out: string[] = [];
    fitted.colons.forEach((colon, at) => {
        const content = contentFor(score, colon);
        const bad = colon.cells.some(cell =>
            cell.held && !cell.flex && countNotes(cellContent(content, cell)) > 1);
        if (bad) {
            out.push(`колено ${at + 1}: распев растянут на лишние слоги — он повторится целиком`);
        }
    });
    return out;
};

export interface AbcOptions {
    /** Показывать подтекстовку. Без неё видна одна мелодия — так удобно разучивать. */
    lyrics?: boolean;
}

/**
 * Партия одного голоса: ноты по коленам и подтекстовка под ними.
 *
 * Нота повторяется на каждом слоге речитатива — как и знамя в крюковой записи:
 * вычитывание десяти слогов на одном звуке пишется десятью нотами, а не одной
 * долгой. Лига поверх них — дело издателя, не наше.
 */
const voicePart = (fitted: Fitted, score: Score, lyrics: boolean): string[] => {
    const out: string[] = [];

    for (const colon of fitted.colons) {
        const content = contentFor(score, colon);
        const notes = colon.cells.map(cell => cellContent(content, cell) || "z").join(" ");
        out.push(`${notes} |`);
        if (lyrics) {
            out.push("w: " + lyricsOf(colon.cells.map(c => ({
                text: c.syllable,
                wordStart: c.wordStart,
                notes: countNotes(cellContent(content, c) || "z"),
            }))) + " |");
        }
    }

    return out;
};

/**
 * Собранный ABC для одного напева.
 *
 * Записей может прийти несколько — это голоса партеса, и они идут одной
 * партитурой, а не четырьмя картинками подряд: партес тем и поётся, что голоса
 * стоят друг под другом и видно, что с чем сходится.
 *
 * Подтекстовку несёт нижний голос ПЕРВОГО стана — то есть встаёт она МЕЖДУ
 * станами, как её и печатают. Текст в партесе один на всех, и повторённый под
 * каждой партией он занимает больше места, чем сами ноты; строки между станами
 * читают оба хора разом.
 */
export const toAbc = (fitted: Fitted, scores: Score[], options: AbcOptions = {}): string => {
    if (!scores.length) return "";

    const byVoice = new Map(scores.map(s => [s.voice, s]));
    const staves = STAVES
        .map(voices => voices.filter(v => byVoice.has(v)))
        .filter(voices => voices.length > 0);
    const lyrics = options.lyrics !== false;

    const key = scores[0].key || "C";
    // Заголовка в ABC нет: имя напева уже стоит над станом на странице, и
    // второй раз внутри нот оно лишнее.
    const head = ["X:1", "M:none", "L:1/4"];

    const single = staves.length === 1 && staves[0].length === 1;
    // Одному голосу партитура не нужна: %%score с единственным голосом
    // добавляет пустую скобку слева от стана.
    if (!single) {
        let n = 0;
        const groups = staves.map(voices => `(${voices.map(() => `V${++n}`).join(" ")})`);
        head.push(`%%score {${groups.join(" ")}}`);
    }
    head.push(`K:${key}`);

    let index = 0;
    const body = staves.flatMap(voices => voices.flatMap((voice, i) => {
        index++;
        const score = byVoice.get(voice)!;
        const declaration = single ? [] : [
            `V:V${index} clef=${STAFF_CLEF[voice]}`
            + (i === 0 ? ` name="${staffName(voices)}"` : ""),
        ];
        // Текст — под нижним голосом первого стана, то есть между станами.
        const carries = lyrics && i === voices.length - 1 && index <= voices.length;
        return [...declaration, ...voicePart(fitted, score, carries)];
    }));

    return [...head, ...body].join("\n");
};

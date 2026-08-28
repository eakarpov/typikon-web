// Дописывает пропущенные ударения в текстах, которые уже размечены.
//
// Речь именно о недосмотре наборщика, а не о разметке текста заново. В «Паренесисе»
// есть строка, где одно и то же слово стоит дважды: «Испо́лните очеса́ ва́ша слез, и
// а́бие отве́рзутся очеса ва́ша у́мная» — первый раз со знаком, второй без. Таких мест
// в собрании около шести с половиной тысяч, разбросанных по двум с лишним тысячам
// текстов, в среднем по три на текст. Глазами их не выловить.
//
// Чего скрипт НЕ делает:
//   * не берётся за тексты, размеченные меньше чем на 90%. Двадцать восемь текстов
//     (крупнейший — «Повесть временных лет», 11 тысяч слов) не размечали никогда;
//     расставить в них ударения — это работа за наборщика, а не исправление, и
//     решать её надо отдельно;
//   * не трогает киноварь {k|…} — уставные пометы, которые страница чтения печатает
//     красным. В богослужебных книгах их не размечают: внутри киновари знак стоит у
//     39% слов против 98% снаружи;
//   * не трогает слова, где корпус даёт два живых положения ударения (ру́ку и руку́),
//     и слова под титлом — сокращения и числа;
//   * не трогает слово, если соседние слова вокруг него тоже без знака. Внутри
//     размеченного текста встречаются целиком неразмеченные куски — заголовок
//     («Иже во святых отца нашего Иоанна, Архиепископа Константинопольского»)
//     или цитируемое зачало, которое толкуется дальше («В начале бе Слово»).
//     Поставить знак одному слову такой строки — сделать её наполовину
//     размеченной, то есть хуже, чем было.
//
// Какое ударение ставить, берётся из словаря корпуса (см. build-accent-dictionary.ts):
// у слова должно быть одно положение знака или одно, перевешивающее прочие на порядок.
//
// Прогон сходится не с первого раза: дописанный знак поднимает плотность вокруг себя,
// и место, которое в прошлый раз выглядело неразмеченным куском, теперь проходит
// проверку соседей. На собрании это заняло пять проходов (5101, 19, 4, 2, 2, 0).
// Разрастись это не может: строка, где размечено меньше половины слов, не проходит
// проверку ни на каком проходе.
//
// Запуск:
//   npx tsx src/scripts/add-missing-accents.ts             # отчёт, ничего не меняет
//   npx tsx src/scripts/add-missing-accents.ts --apply     # записать
//   npx tsx src/scripts/add-missing-accents.ts --limit 30  # больше примеров
import "@/scripts/lib/env";
import { writeFileSync } from "node:fs";
import clientPromise from "@/lib/mongodb";
import { revalidateContent } from "@/scripts/lib/revalidate";
import { CorpusDoc, readChurchSlavonicCorpus } from "@/scripts/lib/corpus";
import {
    accentKey,
    addContent,
    addRates,
    createDraft,
    createRates,
    finalize,
    hasAccent,
    isAbbreviated,
    isAccentExpected,
    isInRubric,
    lookup,
    placeAccent,
    rubricRanges,
    stripAccents,
    syllables,
    WORD_PATTERN,
} from "@/lib/accents/core";

const APPLY = process.argv.includes("--apply");
const limitArg = process.argv.indexOf("--limit");
const SAMPLES = limitArg > 0 ? Number(process.argv[limitArg + 1]) || 12 : 12;

// Доля размеченного, ниже которой текст считается неразмеченным и не трогается.
const MIN_DENSITY = 0.9;

// Сколько раз правильное написание должно встретиться, чтобы по нему ставить знак.
const MIN_SUPPORT = 3;

// Окно соседей, по которому судим, размечено ли это место вообще: сколько слов
// смотреть в каждую сторону и какая доля из них должна нести знак. Соседи берутся
// только из той же строки: заголовок стоит отдельной строкой, и без этого условия
// окно дотягивается до размеченного текста следом и признаёт заголовок размеченным.
const NEIGHBOURS = 4;
const NEIGHBOUR_SHARE = 0.5;
const MIN_NEIGHBOURS = 2;

interface Candidate {
    word: string;
    accented: string;
    at: number;
    support: number;
}

async function main() {
    const client = await clientPromise;
    const db = client.db("typikon");

    console.log("Читаю корпус…");
    const corpus = await readChurchSlavonicCorpus(db);

    const draft = createDraft();
    const rates = createRates();
    for (const doc of corpus.docs) {
        addContent(draft, doc.content);
        addRates(rates, doc.content);
    }
    const dictionary = finalize(draft);

    console.log(`Словарь: ${dictionary.size} основ, слов с известной нормой ударения: ${rates.size}\n`);

    // Только тексты: Библия в verses размечена сплошь, дописывать там нечего.
    const texts = corpus.docs.filter((doc) => doc.collection === "texts");

    const skipped = { thin: 0, rubric: 0, island: 0, unsure: 0, weak: 0, unknown: 0 };
    const examples: string[] = [];
    const allChanges: string[] = [];
    const changes: { doc: CorpusDoc; content: string }[] = [];
    let filled = 0;
    let refused = 0;

    for (const doc of texts) {
        // Насколько текст размечен — считаем только по словам, которым знак положен.
        let need = 0;
        let has = 0;
        for (const word of doc.content.match(WORD_PATTERN) ?? []) {
            if (isAbbreviated(word) || syllables(word) === 0) continue;
            if (!isAccentExpected(rates, accentKey(word))) continue;
            need++;
            if (hasAccent(word)) has++;
        }
        if (need < 30) continue;
        if (has / need < MIN_DENSITY) { skipped.thin++; continue; }

        const ranges = rubricRanges(doc.content);
        const inRubric = (at: number) => isInRubric(ranges, at);

        // Все слова текста, которым знак положен, по порядку — чтобы у каждого
        // кандидата можно было спросить, размечены ли соседи.
        const expectedWords: { word: string; at: number; line: number; accented: boolean }[] = [];
        const scan = new RegExp(WORD_PATTERN.source, "g");
        let found: RegExpExecArray | null;
        let line = 0;
        let scannedTo = 0;
        while ((found = scan.exec(doc.content))) {
            const word = found[0];
            // Номер строки считаем по ходу, а не заново для каждого слова:
            // иначе на тексте в тысячи слов это квадрат.
            for (let i = scannedTo; i < found.index; i++) if (doc.content[i] === "\n") line++;
            scannedTo = found.index;

            if (isAbbreviated(word) || syllables(word) === 0) continue;
            if (!isAccentExpected(rates, accentKey(word))) continue;
            expectedWords.push({ word, at: found.index, line, accented: hasAccent(word) });
        }

        const neighboursMarked = (position: number) => {
            const { line: own } = expectedWords[position];
            const from = Math.max(0, position - NEIGHBOURS);
            const to = Math.min(expectedWords.length, position + NEIGHBOURS + 1);
            const around = expectedWords
                .slice(from, to)
                .filter((item, i) => from + i !== position && item.line === own);
            if (around.length < MIN_NEIGHBOURS) return false;
            return around.filter((item) => item.accented).length / around.length >= NEIGHBOUR_SHARE;
        };

        const candidates: Candidate[] = [];

        for (let position = 0; position < expectedWords.length; position++) {
            const { word, at } = expectedWords[position];
            if (hasAccent(word)) continue;

            const key = accentKey(word);
            if (inRubric(at)) { skipped.rubric++; continue; }
            if (!neighboursMarked(position)) { skipped.island++; continue; }

            const known = lookup(dictionary, key);
            if (!known) { skipped.unknown++; continue; }
            if (known.confidence === "unsure") { skipped.unsure++; continue; }
            if (known.count < MIN_SUPPORT) { skipped.weak++; continue; }

            const accented = placeAccent(word, known.index, known.mark);
            if (!accented) { skipped.unknown++; continue; }

            // Дописать ударение — значит добавить ровно один знак и не тронуть
            // ничего больше: снимаем его обратно и обязаны получить исходное слово.
            if (stripAccents(accented) !== word || [...accented].filter((ch) => ch === known.mark).length !== 1) {
                refused++;
                continue;
            }

            candidates.push({ word, accented, at, support: known.count });
        }

        if (!candidates.length) continue;

        // Собираем текст заново по позициям, с конца — чтобы более ранние
        // смещения оставались верными.
        let content = doc.content;
        for (const candidate of [...candidates].reverse()) {
            content = content.slice(0, candidate.at) + candidate.accented
                + content.slice(candidate.at + candidate.word.length);
        }

        filled += candidates.length;
        changes.push({ doc, content });

        candidates.forEach((candidate) => {
            allChanges.push(`${candidate.word}\t${candidate.accented}\t${candidate.support}\t${doc.label}`);
        });

        if (examples.length < SAMPLES) {
            const candidate = candidates[0];
            const from = Math.max(0, candidate.at - 52);
            const fragment = doc.content
                .slice(from, candidate.at + candidate.word.length + 32)
                .replace(/\s+/g, " ");
            examples.push(`\n  «${candidate.word}» → «${candidate.accented}»   ${doc.label}`
                + `, так размечено ${candidate.support} раз\n     …${fragment}…`);
        }
    }

    console.log(`Дописано ударений: ${filled} в ${changes.length} текстах`);
    console.log(`\nНе тронуто:`);
    console.log(`  текстов, размеченных меньше чем на ${Math.round(MIN_DENSITY * 100)}%: ${skipped.thin}`);
    console.log(`  слов в киновари: ${skipped.rubric}`);
    console.log(`  слов в неразмеченных кусках (заголовки, цитируемые зачала): ${skipped.island}`);
    console.log(`  слов с живым разночтением: ${skipped.unsure}`);
    console.log(`  слов со слишком редкой нормой: ${skipped.weak}`);
    console.log(`  слов, которых нет в словаре: ${skipped.unknown}`);
    if (refused) console.log(`  отклонено страховкой: ${refused}`);

    if (examples.length) {
        console.log(`\nПримеры:`);
        examples.forEach((line) => console.log(line));
    }

    const dumpPath = process.env.ACCENT_DUMP || "/tmp/accent-additions.tsv";
    writeFileSync(dumpPath, "было\tстало\tопора\tгде\n" + allChanges.join("\n"), "utf8");
    console.log(`\nПолный список: ${dumpPath} (${allChanges.length} строк)`);

    if (!APPLY) {
        console.log(`\nЭто предварительный прогон, база не тронута. Повторите с --apply.`);
        process.exit(0);
    }

    if (!changes.length) {
        console.log(`\nДописывать нечего.`);
        process.exit(0);
    }

    const backupPath = process.env.ACCENT_BACKUP || `/tmp/accent-add-backup-${process.pid}.json`;
    writeFileSync(backupPath, JSON.stringify(
        changes.map((change) => ({
            collection: change.doc.collection,
            _id: String(change.doc._id),
            content: change.doc.content,
        })),
    ), "utf8");
    console.log(`\nСнимок прежнего содержимого: ${backupPath}`);

    console.log(`Записываю…`);
    for (const change of changes) {
        await db.collection(change.doc.collection).updateOne(
            { _id: change.doc._id },
            { $set: { content: change.content } },
        );
    }
    console.log(`Записано текстов: ${changes.length}`);
    console.log(`\nПрогоните ещё раз: дописанные знаки поднимают плотность вокруг себя,`);
    console.log(`и часть мест, отложенных как «неразмеченный кусок», теперь пройдёт проверку.`);

    await revalidateContent();
    process.exit(0);
}

main();

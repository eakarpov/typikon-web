// Чинит сбитые знаки ударения в корпусе.
//
// Зачем: знак ударения — отдельный символ, стоящий ПОСЛЕ своей гласной, и при
// наборе или распознавании он легко съезжает на соседнюю букву: «глаѓолет»
// вместо «глаго́лет», «нем́уже» вместо «нему́же», «ра́́ди» с двумя знаками подряд,
// «́аще» со знаком, оторвавшимся в начало слова. Глазами такое не вычитывается:
// на экране отличие в один пиксель, а в тексте его тысячи. Зато словарь ударных
// форм, собранный по самому корпусу, отличает «яќо» от «я́ко» мгновенно —
// в собрании 12 тысяч правильных написаний против трёх десятков сбитых.
//
// Как чиним. Знак не переставляется наугад: по слову без надстрочной разметки
// ищется правильная форма в словаре, из неё берётся НОМЕР ударной гласной, и в
// исходном слове знак ставится после той же по счёту гласной. Само слово при
// этом не подменяется словарной формой — иначе потерялись бы ерок, титло и
// прочая разметка, которой в словарной форме может не оказаться.
//
// Чего скрипт не делает:
//   * не трогает слова, где словарь показывает настоящее разночтение
//     (ру́ку и руку́ обе живые) — их только показывает;
//   * не трогает румынскую Библию: другая орфография, свой набор знаков;
//   * не расставляет недостающие ударения — это отдельная работа.
//
// Запуск:
//   npx tsx src/scripts/fix-accent-marks.ts             # отчёт, ничего не меняет
//   npx tsx src/scripts/fix-accent-marks.ts --apply     # записать правки
//   npx tsx src/scripts/fix-accent-marks.ts --limit 40  # больше примеров в отчёте
import "@/scripts/lib/env";
import { writeFileSync } from "node:fs";
import clientPromise from "@/lib/mongodb";
import { revalidateContent } from "@/scripts/lib/revalidate";
import { CorpusDoc, readChurchSlavonicCorpus } from "@/scripts/lib/corpus";
import {
    AccentDictionary,
    accentKey,
    addContent,
    createDraft,
    finalize,
    findAccentIssues,
    hasAccent,
    isAbbreviated,
    stripAccents,
    isAccent,
    isCombining,
    isVowel,
    lookup,
    OXIA,
    placeAccent,
    unfoldPrecomposed,
    VARIA,
    KAMORA,
    WORD_PATTERN,
} from "@/lib/accents/core";

const APPLY = process.argv.includes("--apply");
const limitArg = process.argv.indexOf("--limit");
const SAMPLES = limitArg > 0 ? Number(process.argv[limitArg + 1]) || 12 : 12;

// Какие виды знака стоят в слове.
const markKinds = (word: string) =>
    new Set([...unfoldPrecomposed(word)].filter((ch) => [OXIA, VARIA, KAMORA].includes(ch)));

// --- перестановка знака -----------------------------------------------------

// Два одинаковых знака подряд — просто лишний символ.
const collapseDoubles = (word: string): string => {
    const chars = [...word];
    const out: string[] = [];
    for (let i = 0; i < chars.length; i++) {
        if (isAccent(chars[i]) && out.length && isAccent(out[out.length - 1])) continue;
        out.push(chars[i]);
    }
    return out.join("");
};

// --- решение по одному слову ------------------------------------------------

type Verdict =
    | { action: "fix"; word: string; reason: string; support: number }
    | { action: "report"; reason: string };

// Сколько раз правильная форма должна встретиться в корпусе, чтобы по ней чинить.
// Единственное встреченное написание — это всё-таки одно свидетельство; такие
// случаи показываем отдельно, чинить их можно вторым заходом с --weak.
const MIN_SUPPORT = 2;
const ALLOW_WEAK = process.argv.includes("--weak");

// Одна верно поставленная гласная плюс знак на согласной — почти наверняка
// задвоение при наборе: слово в церковнославянском несёт одно ударение, и если
// одно из двух стоит на месте, лишний убирается без всякого словаря. Это важно
// для текстов старой графики («добродѣ́тел́ємъ»), где словарь, собранный по
// гражданке, слово попросту не знает.
const dropStray = (word: string): string | null => {
    const chars = [...word];
    const accents = chars.reduce<number[]>((acc, ch, i) => (isAccent(ch) ? [...acc, i] : acc), []);
    if (accents.length !== 2) return null;

    // Плохие знаки берём из общего разбора: каждый оценивается по СВОЕЙ букве.
    // Пробовать «слово до этого знака» нельзя — в «памф́ѷлі́йскій» второй знак
    // стоит верно, но слева от него уже есть сбитый, и по обрезку он тоже
    // выглядел бы ошибочным.
    const bad = findAccentIssues(word)
        .filter((issue) => issue.kind === "on-consonant" || issue.kind === "at-start")
        .map((issue) => issue.at);
    if (bad.length !== 1) return null;

    const trimmed = chars.filter((_, i) => i !== bad[0]).join("");
    return findAccentIssues(trimmed).length ? null : trimmed;
};

const decide = (word: string, dictionary: AccentDictionary): Verdict => {
    const issues = findAccentIssues(word);
    if (!issues.length) return { action: "report", reason: "нет ошибок" };

    if (issues.some((issue) => issue.kind === "crowded")) {
        return { action: "report", reason: "больше двух знаков в слове" };
    }

    // Ударение, вросшее в согласную (ѓ, ќ), сперва разворачиваем в букву со знаком —
    // дальше оно чинится как обычный съехавший знак. Вросшую варию (ѐ, ѝ) не
    // трогаем: там написание правильное, разворачивать его незачем.
    let candidate = /[ѓќЃЌ]/.test(word) ? unfoldPrecomposed(word) : word;

    // Сдвоенный знак чинится без словаря: убираем повтор и смотрим, что осталось.
    if (issues.some((issue) => issue.kind === "doubled")) {
        candidate = collapseDoubles(candidate);
        if (!findAccentIssues(candidate).length) {
            return { action: "fix", word: candidate, reason: "сдвоенный знак", support: 0 };
        }
    }

    // Оторвавшийся в начало знак: если после него слово размечено верно,
    // достаточно убрать лишний символ.
    if (issues.every((issue) => issue.kind === "at-start")) {
        const trimmed = [...candidate].filter((ch, i) => !(i === 0 && isAccent(ch))).join("");
        if (hasAccent(trimmed) && !findAccentIssues(trimmed).length) {
            return { action: "fix", word: trimmed, reason: "знак оторвался в начало", support: 0 };
        }
    }

    const stray = dropStray(candidate);
    if (stray) {
        return { action: "fix", word: stray, reason: "лишний знак при верно стоящем", support: 0 };
    }

    const known = lookup(dictionary, accentKey(word));
    if (!known) return { action: "report", reason: "нет в словаре" };
    if (known.confidence === "unsure") {
        return { action: "report", reason: "разночтение в словаре" };
    }
    if (known.count < MIN_SUPPORT && !ALLOW_WEAK) {
        return { action: "report", reason: "верная форма встретилась лишь однажды" };
    }

    const fixed = placeAccent(candidate, known.index, known.mark);
    if (!fixed || fixed === word) return { action: "report", reason: "не удалось переставить знак" };
    if (findAccentIssues(fixed).length) return { action: "report", reason: "после правки знак всё равно не на гласной" };

    return {
        action: "fix",
        word: fixed,
        support: known.count,
        reason: known.confidence === "sure"
            ? "по словарю, форма единственная"
            : "по словарю, форма преобладает",
    };
};

// --- прогон -----------------------------------------------------------------

async function main() {
    const client = await clientPromise;
    const db = client.db("typikon");

    console.log("Читаю корпус…");
    const corpus = await readChurchSlavonicCorpus(db);
    const docs = corpus.docs;

    // Словарь строится тем же кодом, что и артефакт (npm run accents:build),
    // и только из слов без замечаний — отбор внутри addWord.
    const draft = createDraft();
    for (const doc of docs) addContent(draft, doc.content);
    const dictionary: AccentDictionary = finalize(draft);

    console.log(`Словарь: ${dictionary.size} основ по ${corpus.texts} текстам и ${corpus.verses} стихам.\n`);

    const byKind: Record<string, number> = {};
    const byReason: Record<string, number> = {};
    const examples: string[] = [];
    const allChanges: string[] = [];
    const markChanges: string[] = [];
    const untouched = new Map<string, number>();

    let issueWords = 0;
    let skippedAbbreviations = 0;
    let refused = 0;
    let fixedWords = 0;
    let changedDocs = 0;
    const changes: { doc: CorpusDoc; content: string }[] = [];

    for (const doc of docs) {
        let touched = 0;

        const next = doc.content.replace(WORD_PATTERN, (word) => {
            const issues = findAccentIssues(word);
            if (!issues.length) return word;

            // Под титлом — сокращённое имя или число (к҃є = 25). Ударение там
            // ставится по своим правилам, проверять его этим способом нельзя.
            if (isAbbreviated(word)) {
                skippedAbbreviations++;
                return word;
            }

            issueWords++;
            issues.forEach((issue) => { byKind[issue.kind] = (byKind[issue.kind] ?? 0) + 1; });

            const verdict = decide(word, dictionary);

            // Правка обязана менять ТОЛЬКО знаки ударения. Если сняв их, мы
            // получаем не то же самое слово — где-то потерялась буква, ерок или
            // титло, и такую правку принимать нельзя ни при какой уверенности.
            if (verdict.action === "fix" && stripAccents(verdict.word) !== stripAccents(word)) {
                refused++;
                byReason["правка меняла бы не только ударение — отклонена"] =
                    (byReason["правка меняла бы не только ударение — отклонена"] ?? 0) + 1;
                return word;
            }

            byReason[verdict.reason] = (byReason[verdict.reason] ?? 0) + 1;

            if (verdict.action !== "fix") {
                untouched.set(word, (untouched.get(word) ?? 0) + 1);
                return word;
            }

            fixedWords++;
            touched++;

            // Тип знака (оксия / вария / камора) зависит не только от слова, но и
            // от места во фразе: в конце колона ставится вария. Словарь этого знать
            // не может, поэтому если правка не просто переставила знак, а сменила
            // его вид — показываем отдельно, молча такое проходить не должно.
            const before = markKinds(word);
            const after = markKinds(verdict.word);
            if ([...after].some((mark) => !before.has(mark))) {
                markChanges.push(`  ${word} → ${verdict.word}   (${doc.label})`);
            }
            allChanges.push(`${word}\t${verdict.word}\t${verdict.reason}\t${verdict.support || ""}\t${doc.label}`);
            if (examples.length < SAMPLES) {
                const support = verdict.support ? `, ${verdict.support} верных написаний` : "";
                examples.push(`  ${word} → ${verdict.word}   (${verdict.reason}${support}, ${doc.label})`);
            }
            return verdict.word;
        });

        if (touched) {
            changedDocs++;
            changes.push({ doc, content: next });
        }
    }

    console.log(`Слов со сбитым знаком: ${issueWords}`);
    console.log(`  (пропущено под титлом, это сокращения и числа: ${skippedAbbreviations})`);
    Object.entries(byKind).sort((a, b) => b[1] - a[1])
        .forEach(([kind, n]) => console.log(`  ${kind}: ${n}`));

    console.log(`\nЧиним: ${fixedWords} слов в ${changedDocs} документах`);
    Object.entries(byReason).sort((a, b) => b[1] - a[1])
        .forEach(([reason, n]) => console.log(`  ${reason}: ${n}`));

    if (examples.length) {
        console.log(`\nПримеры правок:`);
        examples.forEach((line) => console.log(line));
    }

    const rest = [...untouched.entries()].sort((a, b) => b[1] - a[1]).slice(0, SAMPLES);
    if (rest.length) {
        console.log(`\nОставлено как есть, самое частое:`);
        rest.forEach(([word, n]) => console.log(`  ${word} ×${n}`));
    }

    if (markChanges.length) {
        console.log(`\nПравки, сменившие вид знака (${markChanges.length}) — проверьте отдельно:`);
        markChanges.forEach((line) => console.log(line));
    }

    if (refused) {
        console.log(`\nОтклонено страховкой (правка задевала не только ударение): ${refused}`);
    }

    // Полный список правок на диск: две тысячи строк в консоль не читаются,
    // а глазами по ним пройтись до записи в базу стоит.
    const dumpPath = process.env.ACCENT_DUMP || "/tmp/accent-fixes.tsv";
    writeFileSync(dumpPath, "было\tстало\tоснование\tопора\tгде\n" + allChanges.join("\n"), "utf8");
    console.log(`\nПолный список правок: ${dumpPath} (${allChanges.length} строк)`);

    if (!APPLY) {
        console.log(`\nЭто предварительный прогон, база не тронута. Повторите с --apply.`);
        process.exit(0);
    }

    // Снимок прежнего содержимого до записи: правка задевает сотни документов,
    // и вернуть их без этого можно будет только из общего дампа базы.
    const backupPath = process.env.ACCENT_BACKUP || `/tmp/accent-backup-${process.pid}.json`;
    writeFileSync(backupPath, JSON.stringify(
        changes.map((change) => ({
            collection: change.doc.collection,
            _id: String(change.doc._id),
            content: change.doc.content,
        })),
    ), "utf8");
    console.log(`\nСнимок прежнего содержимого: ${backupPath}`);

    console.log(`Записываю…`);
    let written = 0;
    for (const change of changes) {
        await db.collection(change.doc.collection).updateOne(
            { _id: change.doc._id },
            { $set: { content: change.content } },
        );
        written++;
    }
    console.log(`Записано документов: ${written}`);

    // Поисковые поля строятся из content — после правки их надо пересобрать.
    console.log(`\nВнимание: поисковые копии (searchName/searchContent) собираются из content.`);
    console.log(`Ударения при нормализации снимаются, поэтому на поиск эта правка не влияет.`);

    await revalidateContent();
    process.exit(0);
}

main();

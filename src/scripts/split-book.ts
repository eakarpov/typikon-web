// Режет книги, залитые одним документом, на главы (разделы) и превращает прежний
// адрес в оглавление этой части.
//
// Две книги, два способа найти границу:
//
//   ифика   — заголовок главы в оригинале ничем не размечен, но и не похож на текст:
//             короткий абзац без табуляции, без ссылки на сноску в начале и без
//             номера-с-двоеточием. Даёт 67 глав — ровно столько символов в книге.
//             Оставшиеся ложные срабатывания перечислены поимённо в NOT_A_HEADING:
//             это короткие абзацы основного текста и строки двух таблиц-вставок.
//
//   правила — резать не нужно угадывать: заголовки соборов и отцов набраны прописными,
//             каждое правило начинается отдельным абзацем «ПРА́ВИЛО н҃в.». Номера
//             правил разбираются как церковнославянские числа и проверяются на
//             непрерывность: в каждом разделе должно получиться 1..N без пропусков.
//             Несовпадение — это ошибка нарезки, и скрипт о ней говорит.
//
// Каждое правило получает якорь {a|82}: раздел остаётся одной страницей, но на
// конкретное правило можно сослаться — /reading/<раздел>#p-82.
//
// Прежний адрес: если из текста вышел один раздел, текст не трогается. Если несколько —
// по нему остаётся оглавление части (то, что стояло до первого заголовка, плюс список
// вышедших разделов ссылками {t|alias|имя}).
//
// Требует, чтобы текст был уже прогнан через normalize-hip (есть поле hipSource).
//
// Запуск:
//   npx tsx src/scripts/split-book.ts --book=ifika     // что получится
//   npx tsx src/scripts/split-book.ts --book=pravila
//   npx tsx src/scripts/split-book.ts --book=ifika --apply
import "@/scripts/lib/env";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { buildSearchFields } from "@/lib/search";
import { revalidateContent } from "@/scripts/lib/revalidate";
import { normalizeHip, csNumber } from "@/scripts/lib/hip";

const APPLY = process.argv.includes("--apply");
const BOOK = process.argv.find((a) => a.startsWith("--book="))?.slice("--book=".length);

type Chunk = { title: string; paragraphs: string[]; rules: number[] };

const paragraphsOf = (content: string) => content.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

// --- Ифика ---------------------------------------------------------------

// Короткие абзацы, которые эвристика принимает за заголовок, а это основной текст
// либо строка таблицы-вставки. Проверено глазами по холостому прогону.
const NOT_A_HEADING = new Set([
    // Титул книги — преамбула оглавления, а не первая глава.
    "И҆́ѲІКА І҆ЕРОПОЛІ́ТИКА,",
    "и҆лѝ філосо́фіа нравоꙋчи́телная,",
    "Кни́гъ ѻ҆боегѡ̀ Завѣ́та:",
    "Го́рдости, и҆ смире́нія.",
    "Ѻ҆ба́че же сіѐ да вѣ́мы:",
    "Ѡ҆живля́емъ же ́є҆гѡ̀ раздаю́ще своя̀ и҆́стая.",
    "и҆зли́шнія ча́сти листа̀ сегѡ̀ съ собо́рнагѡ посла́нія. і҆а́кѡвля. глава̀ а҃.",
    "Бг҃ꙋ ́є҆ди́номꙋ промы́сленникꙋ и҆ пособи́телю сла́ва.",
    // Подзаголовки внутри последней главы «Въ дополненіе» — не самостоятельные главы.
    "КЪ НЕРАДИ́ВЫМЪ.",
    "КЪ ТЩАЛИ́ВЫМЪ.",
    "Ѹ҆КОРИ́ТЕЛЮ.",
    "ТОМꙊ́ЖДЕ, премⷣ: г҃:",
]);

const isIfikaHeading = (p: string) =>
    p.length < 90 &&
    !p.includes("\t") &&
    !p.startsWith("{") &&
    !/^\S{1,4}:\s/.test(p) &&
    !/^\{p\|[^}]*\}$/.test(p) &&
    !NOT_A_HEADING.has(p);

// --- Книга правил --------------------------------------------------------

// Нумерованная единица раздела: у соборов и отцов это правило, у Тимофея
// Александрійскаго — вопрос с ответом. И то, и другое адресуется якорем.
const RULE = /^(?:ПРА́ВИЛО|ВОПРО́СЪ)\s+([^\s.]+)\.?/;

// Титул книги — преамбула оглавления, а не раздел.
const PRAVILA_FRONT = new Set([
    "КНИ́ГА ПРА́ВИЛЪ СВЯТЫ́ХЪ А҆ПО́СТОЛѠВЪ, СВЯТЫ́ХЪ СОБО́РѠВЪ ВСЕЛЕ́НСКИХЪ И҆ ПОМѢ́СТНЫХЪ, И҆ СВЯТЫ́ХЪ Ѻ҆ТЄ́ЦЪ",
]);

// Символы веры и догматы набраны заголовком в два абзаца: короткое название
// и следом, отдельным абзацем, чьи они. По одному первому абзацу их не различить
// («ДОГМА́ТЪ» встречается трижды), поэтому второй абзац входит в название.
const TWO_LINE_TITLE = new Set(["СѶМВО́ЛЪ ВѢ́РЫ", "ДОГМА́ТЪ"]);

// Заголовок раздела: первое слово прописными, и это не «ПРАВИЛО н҃».
// Короткие прописные строки («ВСТꙊПЛЕ́НІЕ», «ПРЕДИСЛО́ВІЕ», «ВОПРО́СЪ а҃», «ѾВѢ́ТЪ»)
// раздела не открывают — это подзаголовки внутри сочинения.
const isPravilaHeading = (p: string) => {
    if (RULE.test(p)) return false;
    if (TWO_LINE_TITLE.has(p)) return true;
    // Верхняя граница подобрана по данным: длиннее 130 знаков в книге ровно три
    // заголовка — Діонѵсіа (143), Тімоѳеа (153) и Геннадіа (160), и ни одного
    // абзаца основного текста, начинающегося прописным словом.
    if (p.length > 200 || p.length < 20) return false;
    if (PRAVILA_FRONT.has(p)) return false;
    const first = p.split(/\s+/)[0]?.replace(/[^\p{L}]/gu, "") ?? "";
    return first.length > 2 && first === first.toUpperCase() && first !== first.toLowerCase();
};

// --- общее ---------------------------------------------------------------

const cut = (paragraphs: string[], isHeading: (p: string) => boolean) => {
    const front: string[] = [];
    const chunks: Chunk[] = [];
    let awaitingSecondLine = false;
    for (const p of paragraphs) {
        if (awaitingSecondLine) {
            awaitingSecondLine = false;
            chunks[chunks.length - 1].title += ` ${p}`;
            continue;
        }
        if (isHeading(p)) {
            chunks.push({ title: p, paragraphs: [], rules: [] });
            awaitingSecondLine = TWO_LINE_TITLE.has(p);
            continue;
        }
        if (!chunks.length) front.push(p);
        else chunks[chunks.length - 1].paragraphs.push(p);
    }
    return { front, chunks };
};

// Нумерация правил у отцов сквозная через все их послания, а у соборов начинается
// с единицы. Поэтому раздел открывает только тот заголовок, после которого счёт
// пошёл заново; остальные — внутренние подзаголовки, они возвращаются в текст.
// Пустой заголовок-обрывок приклеивается к следующему (в книге «ПРА̑ВИЛА» и название
// собора набраны двумя абзацами), а шмуцтитул без текста уходит строкой в оглавление.
const mergeContinuations = (chunks: Chunk[]) => {
    const out: Chunk[] = [];
    const dividers: { before: number; title: string }[] = [];
    for (let i = 0; i < chunks.length; i += 1) {
        const chunk = chunks[i];
        const previous = out[out.length - 1];
        const next = chunks[i + 1];

        // Шмуцтитул несёт максимум колонтитул — текста под ним нет. Сам колонтитул
        // при этом отбрасывать нельзя: страница на нём и начинается, поэтому он
        // переезжает в начало следующего раздела.
        const pageMarks = chunk.paragraphs.filter((p) => /^\{p\|[^}]*\}$/.test(p));
        const hasBody = chunk.paragraphs.length > pageMarks.length;
        if (!hasBody) {
            if (next) next.paragraphs.unshift(...pageMarks);
            if (chunk.title.length < 15 && next) next.title = `${chunk.title} ${next.title}`;
            else dividers.push({ before: out.length, title: chunk.title });
            continue;
        }
        if (previous && chunk.rules.length && chunk.rules[0] !== 1) {
            previous.paragraphs.push(chunk.title, ...chunk.paragraphs);
            previous.rules.push(...chunk.rules);
            continue;
        }
        out.push(chunk);
    }
    return { chunks: out, dividers };
};

// Правилам раздаём якоря и попутно собираем номера для проверки.
const anchorRules = (chunk: Chunk) => {
    chunk.paragraphs = chunk.paragraphs.map((p) => {
        const m = p.match(RULE);
        if (!m) return p;
        const n = csNumber(m[1]);
        if (n === null) return p;
        chunk.rules.push(n);
        return `{a|${n}}${p}`;
    });
};

const titleOf = (raw: string) =>
    raw.replace(/\{\d+\}/g, "").replace(/\{p\|[^}]*\}/g, "").replace(/\s+/g, " ").replace(/[.,;:]+$/, "").trim();

// --- Алфавитный указатель ------------------------------------------------

// Раздел указателя открывает абзац из одной буквы с точкой: «А.», «Ѻ.», «Оꙋ.».
const isLetterHeading = (p: string) => /^[\p{L}]{1,2}\.$/u.test(p);

type Profile = {
    sources: string[];
    isHeading: (p: string) => boolean;
    anchors: boolean;
    // Алиасы новых текстов: по умолчанию продолжают нумерацию исходного.
    aliasPrefix?: string;
    // Приставка к названию раздела в списке книги.
    titlePrefix?: string;
    // С какого числа продолжать bookIndex: указатель встаёт после правил.
    bookIndexBase?: number;
};

const BOOKS: Record<string, Profile> = {
    ifika: { sources: ["ifika-1"], isHeading: isIfikaHeading, anchors: false },
    pravila: {
        sources: [1, 2, 3, 4, 5, 6, 7].map((n) => `pravila-svatyh-apostol-${n}`),
        isHeading: isPravilaHeading,
        anchors: true,
    },
    ukazatel: {
        sources: ["pravila-ukazatel"],
        isHeading: isLetterHeading,
        anchors: false,
        aliasPrefix: "pravila-ukazatel",
        titlePrefix: "Указатель: ",
        bookIndexBase: 41,
    },
};

async function main() {
    const profile = BOOK ? BOOKS[BOOK] : undefined;
    if (!profile) {
        console.log(`Укажите книгу: --book=${Object.keys(BOOKS).join(" | --book=")}`);
        process.exit(1);
    }

    const client = await clientPromise;
    const db = client.db("typikon");
    const texts = db.collection("texts");
    const books = db.collection("books");

    // Новые алиасы продолжают нумерацию существующих, чтобы прежние адреса жили.
    const prefix = profile.aliasPrefix ?? profile.sources[0].replace(/-\d+$/, "");
    const existing = await texts.find({ alias: new RegExp(`^${prefix}-\\d+$`) }, { projection: { alias: 1 } }).toArray();
    const numbers = existing.map((d) => Number(String(d.alias).replace(`${prefix}-`, "")));
    let nextNumber = numbers.length ? Math.max(...numbers) + 1 : 1;

    // Повторный прогон (часть текстов уже стала оглавлениями) не может пересчитать
    // сквозной bookIndex — тогда трогаем только содержимое, а порядок не переставляем.
    const sourceDocs = await texts.find({ alias: { $in: profile.sources } }, { projection: { content: 1 } }).toArray();
    const isRerun = sourceDocs.some((d) => (d.content ?? "").includes("{t|"));

    // Нумерация продолжает книгу: если в ней уже есть тексты, не входящие в нарезку
    // (как разделы Книги правил при нарезке указателя), новые встают после них.
    let bookIndex = profile.bookIndexBase ?? 0;
    let created = 0;
    const problems: string[] = [];

    for (const alias of profile.sources) {
        const doc = await texts.findOne({ alias });
        if (!doc) {
            problems.push(`${alias}: не найден`);
            continue;
        }
        // Записывать можно только по нормализованному тексту. Для холостого прогона
        // нормализуем в памяти, чтобы посмотреть будущее оглавление, ничего не меняя.
        let content: string = doc.content ?? "";
        if (!doc.hipSource) {
            if (APPLY) {
                problems.push(`${alias}: не нормализован, сначала normalize-hip --apply`);
                continue;
            }
            content = normalizeHip(content).content;
            console.log(`\n(${alias}: не нормализован, для показа нормализован в памяти)`);
        }

        // Уже разрезанный текст стал оглавлением: второй прогон разобрал бы список
        // ссылок как содержимое книги.
        if (content.includes("{t|")) {
            console.log(`\n${alias}: уже оглавление, пропуск`);
            continue;
        }

        const cutResult = cut(paragraphsOf(content), profile.isHeading);
        const front = cutResult.front;
        let chunks = cutResult.chunks;
        let dividers: { before: number; title: string }[] = [];
        if (profile.anchors) {
            chunks.forEach(anchorRules);
            const merged = mergeContinuations(chunks);
            chunks = merged.chunks;
            dividers = merged.dividers;
        }

        console.log(`\n=== ${alias} — ${doc.name ?? ""}: разделов ${chunks.length}${front.length ? `, преамбулы ${front.length} абз.` : ""}`);

        if (chunks.length <= 1) {
            bookIndex += 1;
            // Резать нечего, но якоря правилам всё равно нужны — иначе #p-N работал бы
            // в одних разделах книги и молча не работал в других.
            const whole = [...front, ...chunks.flatMap((c) => [c.title, ...c.paragraphs])].join("\n\n");
            const rules = chunks[0]?.rules ?? [];
            console.log(
                `    один раздел, текст остаётся как есть (bookIndex ${bookIndex})` +
                (rules.length ? `, якорей ${rules.length}` : ""),
            );
            if (APPLY) {
                await texts.updateOne(
                    { _id: doc._id },
                    { $set: isRerun ? { content: whole } : { bookIndex, content: whole } },
                );
            }
            continue;
        }

        const planned: { alias: string; title: string; content: string; size: number; rules: number[] }[] = [];
        for (const chunk of chunks) {
            const content = [chunk.title, ...chunk.paragraphs].join("\n\n");
            planned.push({
                alias: `${prefix}-${nextNumber++}`,
                title: `${profile.titlePrefix ?? ""}${titleOf(chunk.title)}`,
                content,
                size: content.length,
                rules: chunk.rules,
            });
        }

        // Оглавление занимает прежний адрес: преамбула плюс список разделов ссылками.
        // Шмуцтитулы («Правила Вселенских соборов») остаются в оглавлении
        // группирующими строками, но собственной страницы не получают.
        const tocLines: string[] = [];
        planned.forEach((p, i) => {
            for (const d of dividers.filter((x) => x.before === i)) tocLines.push(titleOf(d.title));
            tocLines.push(`{t|${p.alias}|${p.title}}`);
        });
        const toc = [...front, ...tocLines].join("\n\n");

        bookIndex += 1;
        console.log(`    прежний адрес /reading/${alias} -> оглавление (${toc.length} знаков, ${planned.length} ссылок)`);

        for (const p of planned) {
            bookIndex += 1;
            const rulesInfo = p.rules.length
                ? `  правил ${p.rules.length}` +
                  (p.rules.every((n, i) => n === i + 1) ? " (1..N без пропусков)" : `  ПРОПУСКИ: ${p.rules.join(",")}`)
                : "";
            if (p.rules.length && !p.rules.every((n, i) => n === i + 1)) {
                problems.push(`${p.title}: номера правил идут не подряд`);
            }
            console.log(`    ${String(bookIndex).padStart(3)}  ${String(p.size).padStart(7)} зн.${rulesInfo}  ${p.alias}  ${p.title.slice(0, 60)}`);

            if (APPLY) {
                const { insertedId } = await texts.insertOne({
                    name: p.title,
                    alias: p.alias,
                    content: p.content,
                    description: "",
                    start: "",
                    fileId: null,
                    link: null,
                    ruLink: null,
                    bookId: doc.bookId,
                    bookIndex,
                    footnotes: doc.footnotes ?? [],
                    // Признаки подачи наследуются от исходного текста: без newUi
                    // разделы показывали бы звёздочки markdown вместо выделения.
                    csSource: Boolean(doc.csSource),
                    newUi: Boolean(doc.newUi),
                    contentType: doc.contentType,
                    type: doc.type,
                    readiness: doc.readiness,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    ...buildSearchFields({ name: p.title, content: p.content } as any),
                });
                await books.updateOne({ _id: doc.bookId as ObjectId }, { $addToSet: { texts: insertedId } });
                created += 1;
            }
        }

        if (APPLY) {
            await texts.updateOne(
                { _id: doc._id },
                {
                    $set: {
                        name: `${String(doc.name).replace(/ — оглавление$/, "")} — оглавление`,
                        content: toc,
                        bookIndex: bookIndex - planned.length,
                        updatedAt: new Date(),
                        ...buildSearchFields({ name: doc.name, content: toc } as any),
                    },
                },
            );
        }
    }

    // Порядок в книге задаётся bookIndex, и наложение двух нарезок на один номер
    // тихо перемешает список. Проверяем прежде, чем отчитаться об успехе.
    if (APPLY) {
        const bookOf = await texts.findOne({ alias: profile.sources[0] }, { projection: { bookId: 1 } });
        const all = await texts
            .find({ bookId: bookOf?.bookId }, { projection: { alias: 1, bookIndex: 1 } })
            .toArray();
        const seen = new Map<number, string>();
        for (const t of all.sort((a, b) => (a.bookIndex ?? 0) - (b.bookIndex ?? 0))) {
            const clash = seen.get(t.bookIndex ?? 0);
            if (clash) problems.push(`bookIndex ${t.bookIndex} занят дважды: ${clash} и ${t.alias}`);
            else seen.set(t.bookIndex ?? 0, String(t.alias));
        }
    }

    if (problems.length) {
        console.log(`\nПРОБЛЕМЫ:`);
        for (const p of problems) console.log(`  ${p}`);
    }

    if (!APPLY) {
        console.log(`\nХолостой прогон, база не тронута. Записать: npx tsx src/scripts/split-book.ts --book=${BOOK} --apply`);
        process.exit(0);
    }

    console.log(`\nСоздано текстов: ${created}`);
    await revalidateContent();
    process.exit(0);
}

// csNumber переиспользуется тестами, поэтому запускаемся только при прямом вызове.
if (process.argv[1]?.endsWith("split-book.ts")) {
    main().catch((e) => {
        console.error(e);
        process.exit(1);
    });
}

// Заливает расшифровки Великих Четьих-Миней из typikon-su в библиотеку.
//
// Источник — по файлу на день: `<месяц>/NN-<месяц>.md`, каждый собран из
// постраничной расшифровки и устроен одинаково:
//
//     # заголовок и правила записи      ← шапка, в книгу не идёт
//     ---
//     ## <название слова>               ← начинает ТЕКСТ
//     абзацы, ссылки на сноски [^7]
//     ### <подзаголовок>                ← остаётся ВНУТРИ текста
//     ---
//     [^7]: пояснение издателя          ← сноски всего дня разом
//
// Разрезаем по `##`, потому что так устроена сама книга: каждое «В ТОЙ ЖЕ ДЕНЬ…» —
// отдельное слово, и на сайте это отдельный текст. `###` (главки «Чюдо 1-е»)
// разрезом не служат: это части одного жития, и разнеси их — читать пришлось бы
// по кускам.
//
// СНОСКИ ПЕРЕНУМЕРОВЫВАЮТСЯ. В источнике они сквозные по дню (`[^22]`), а в базе
// у текста свой массив, и разметка в содержимом — `{N}`, где N — номер В ЭТОМ
// массиве. Поэтому каждому тексту достаются только его сноски, пронумерованные
// с единицы.
//
// Опечатки издания (`opechatki-izdaniya.md`) ложатся в `adminInfo` — это заметка
// корректору, а не часть памятника, и в содержимом её быть не должно. Привязка —
// ПО ЦИТАТЕ, а не по номеру страницы: страницы в сводном файле уже не размечены,
// зато напечатанное выписано дословно и находится поиском. Что не нашлось —
// печатается в конце прогона, а не теряется молча.
//
// Идемпотентность: книга ищется по имени, текст — по alias. Повторный прогон
// обновляет те же документы, порядок и содержимое совпадут с первым. Тексты,
// заведённые прошлым прогоном и пропавшие из источника, показываются, но сами
// не удаляются: удаление — с `--prune`, чтобы опечатка в заголовке не стирала
// вычитанный кем-то текст.
//
// Запуск:  NODE_ENV=development npx tsx src/scripts/import-vmch.ts [--dry-run] [--prune] [--month=сентябрь]
import "@/scripts/lib/env";
import fs from "node:fs";
import path from "node:path";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { buildSearchFields } from "@/lib/search";
import { normalizeParagraphs, TextKind, TextReadiness } from "@/utils/texts";

const SOURCE_ROOT = path.resolve(process.cwd(), "../typikon-su");

// Месяцы заводятся по мере разбора; ключ — имя папки в typikon-su.
const MONTHS = [
    { folder: "Четьи-минеи сентябрь", genitive: "сентября", title: "сентябрь", num: 9 },
    { folder: "Четьи-минеи октябрь", genitive: "октября", title: "октябрь", num: 10 },
    { folder: "Четьи-минеи ноябрь", genitive: "ноября", title: "ноябрь", num: 11 },
];

// Набор гражданский, дореформенный — то же, что у «Синаксарей Постной Триоди»
// («Въ то́йже де́нь»). Уставное начертание (`cu`) потребовало бы церковного
// шрифта, а здесь его нет: ни титл, ни юсов в расшифровке не встречается.
const LANGUAGE = "cu_gr";

// «Отекстовано», а не «Готово»: текст набран по изданию, но ударения не
// расставлены — это отдельный этап, и до него называть его готовым нельзя.
const READINESS = TextReadiness.TEXTING;

interface ParsedText {
    heading: string;
    day: number;
    order: number;
    paragraphs: string[];
    footnoteRefs: number[];   // сквозные номера дня, в порядке первого появления
    headingRefs: number[];    // сноска, стоящая при самом заголовке
    editorial: string[];      // мои пометки в тексте — в содержимое не идут
}

interface Erratum {
    page: string;
    printed: string;
    expected: string;
    kind: string;
    doubtful: boolean;
}

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const PRUNE = args.includes("--prune");
const ONLY_MONTH = args.find((a) => a.startsWith("--month="))?.slice("--month=".length);

// ── разбор дневного файла ────────────────────────────────────────────────────

// Шапка и сноски отделены строкой `---`; между ними тело.
//
// Разделителей бывает и больше двух: в файле за 1 сентября внутри тела осталась
// черта от ручной сборки. Поэтому опознаём не по счёту, а по краям — шапка
// первая, сноски последние, тело всё, что между. Что последняя часть и правда
// сноски, проверяем: сместись граница — в книгу уехали бы правила записи.
const splitFile = (raw: string) => {
    const parts = raw.split(/\n---\n/);
    if (parts.length < 3) {
        throw new Error(`ожидались шапка / тело / сноски через "---", а нашлось ${parts.length} частей`);
    }
    const notes = parts[parts.length - 1];
    if (!/^\[\^\d+\]:/m.test(notes)) {
        throw new Error("последняя часть файла не похожа на список сносок");
    }
    return { head: parts[0], body: parts.slice(1, -1).join("\n"), notes };
};

const parseNotes = (notes: string): Map<number, string> => {
    const map = new Map<number, string>();
    for (const line of notes.split("\n")) {
        const m = line.match(/^\[\^(\d+)\]:\s*(.+)$/);
        if (m) map.set(parseInt(m[1], 10), m[2].trim());
    }
    return map;
};

// Мои пометки о том, чего в тексте нет (гравюры, обрывы) — набраны `*[...]*`.
const EDITORIAL = /^\*\[[\s\S]*\]\*$/;

const parseBody = (body: string, day: number): ParsedText[] => {
    const texts: ParsedText[] = [];
    let current: ParsedText | null = null;
    let order = 0;

    for (const chunk of body.split(/\n\s*\n/)) {
        const block = chunk.trim();
        if (!block) continue;

        if (block.startsWith("## ")) {
            const raw = block.slice(3).trim();
            current = {
                // Сноска бывает и при самом заголовке («…мученика Мамы[^1]»):
                // она про всё слово целиком. В названии ей не место, в
                // содержимом её некуда поставить — уходит в заметку админу,
                // иначе пояснение издателя просто пропало бы.
                heading: raw.replace(/\[\^\d+\]/g, "").trim(),
                day,
                order: (order += 1),
                paragraphs: [],
                footnoteRefs: [],
                headingRefs: [...raw.matchAll(/\[\^(\d+)\]/g)].map((m) => parseInt(m[1], 10)),
                editorial: [],
            };
            texts.push(current);
            continue;
        }
        if (!current) continue;   // до первого `##` тела не бывает

        if (EDITORIAL.test(block)) {
            current.editorial.push(block.replace(/^\*\[|\]\*$/g, "").replace(/\s+/g, " ").trim());
            continue;
        }

        // `### Чюдо 1-е` и `*Стих:*` — часть чтения, а не разметка: снимаем
        // решётки и звёздочки, абзац остаётся на месте.
        const text = block.startsWith("### ")
            ? block.slice(4).trim()
            : block.replace(/\*([^*]+)\*/g, "$1");

        for (const m of text.matchAll(/\[\^(\d+)\]/g)) {
            const n = parseInt(m[1], 10);
            if (!current.footnoteRefs.includes(n)) current.footnoteRefs.push(n);
        }
        current.paragraphs.push(text.replace(/\n/g, " ").replace(/\s+/g, " ").trim());
    }
    return texts;
};

// ── опечатки ─────────────────────────────────────────────────────────────────

const parseErrata = (raw: string): Map<number, Erratum[]> => {
    const byDay = new Map<number, Erratum[]>();
    let day: number | null = null;
    let doubtful = false;

    for (const line of raw.split("\n")) {
        const dayHeading = line.match(/^##\s+(\d+)\s+\S+/);
        if (dayHeading) {
            day = parseInt(dayHeading[1], 10);
            doubtful = false;
            continue;
        }
        if (/^###\s+Сомнительное/.test(line)) { doubtful = true; continue; }
        if (/^###\s+Подтверждено/.test(line)) { doubtful = false; continue; }
        if (day === null || !line.startsWith("|")) continue;

        const cells = line.split("|").slice(1, -1).map((c) => c.trim());
        // Ячейка страницы бывает не одним числом: дефект тянется через разворот
        // («189–190») или одно и то же место набрано в двух редакциях дня
        // («177, 186»). Такие строки — полноценные записи реестра, и отбрасывать
        // их вместе с шапкой таблицы нельзя: они пропадали молча.
        if (cells.length < 2 || !/^\d+(\s*[–—,\/]\s*\d+)*$/.test(cells[0])) continue;   // шапка таблицы

        if (!byDay.has(day)) byDay.set(day, []);
        byDay.get(day)!.push({
            page: cells[0],
            printed: cells[1],
            expected: cells.length >= 4 ? cells[2] : "",
            kind: cells[cells.length - 1],
            doubtful,
        });
    }
    return byDay;
};

const forSearch = (s: string) =>
    s.replace(/[`*]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

// Цитата в реестре бывает с пропуском (`…` или `...`) и с разрывом строки (`/`) —
// ищем по самому длинному сплошному куску, он и опознаёт место однозначно.
//
// Дефис снимается: в реестре слово выписано так, как разорвано в книге
// (`всу-пртивитися`), а в расшифровке переносы уже сведены.
//
// Ячейка бывает и составной — «заголовокъ `А`, первая же строка `Б`»: тогда
// искать надо не её целиком, а каждую цитату из обратных кавычек по отдельности.
const searchCandidates = (printed: string): string[] => {
    const quoted = [...printed.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    const chunks = (quoted.length ? quoted : [printed])
        .flatMap((c) => forSearch(c).replace(/-/g, "").split(/…|\.\.\.|\s\/\s|\//))
        .map((c) => c.trim())
        .filter((c) => c.length >= 6);
    return [...new Set(chunks)].sort((a, b) => b.length - a.length);
};

// ── прочее ───────────────────────────────────────────────────────────────────

const TRANSLIT: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i", й: "y",
    к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u",
    ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e",
    ю: "yu", я: "ya", ѣ: "e", і: "i", ѳ: "f", ѵ: "i", ѡ: "o", ѧ: "ya", ѹ: "u",
};

// Заголовки в книге начинаются одинаково — «В ТОЙ ЖЕ ДЕНЬ…», «Мѣсяца септевріа
// въ 1 день…», — и slug по первым словам вышел бы у половины текстов дня один и
// тот же. Отличает их то, что идёт ПОСЛЕ формулы, её и берём.
const FORMULA = [
    /^(въ|в)\s+(той|тъй|тый)\s+же\s+день[,.]?\s*/i,
    /^м[еѣ]сяца\s+того\s+же\s+(въ|в)\s+\d+([,.]|\s+день[,.]?)\s*/i,
    /^м[еѣ]сяца\s+[а-яё]+\s+(въ|в)\s+[\dа-яё]+\s+день[,.]?\s*/i,
];

const slug = (s: string) => {
    const prologue = /^пролог/i.test(s) ? "prolog-" : "";
    let rest = s.replace(/^пролог[.\s]*/i, "");
    for (const re of FORMULA) rest = rest.replace(re, "");
    const words = [...(rest.trim() || s).toLowerCase()]
        .map((ch) => (TRANSLIT[ch] !== undefined ? TRANSLIT[ch] : /[a-z0-9]/.test(ch) ? ch : " "))
        .join("")
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    return (prologue + words.slice(0, 6).join("-")).replace(/-+/g, "-").replace(/^-|-$/g, "");
};

const kindOf = (heading: string): TextKind => {
    const h = heading.toLowerCase();
    if (h.includes("пролог")) return TextKind.HISTORIC;
    if (/(^|[\s,])(слово|поучение|поучениа|наказание|беседа)/.test(h)) return TextKind.TEACHIND;
    return TextKind.HISTORIC;
};

// ── прогон ───────────────────────────────────────────────────────────────────

const run = async () => {
    const client = await clientPromise;
    const db = client.db("typikon");

    for (const month of MONTHS) {
        if (ONLY_MONTH && month.title !== ONLY_MONTH) continue;
        const dir = path.join(SOURCE_ROOT, month.folder);
        if (!fs.existsSync(dir)) continue;

        const dayFiles = fs
            .readdirSync(dir)
            .filter((f) => /^\d\d-[a-z]+\.md$/.test(f))
            .sort();
        if (!dayFiles.length) continue;

        const errataPath = path.join(dir, "opechatki-izdaniya.md");
        const errata = fs.existsSync(errataPath)
            ? parseErrata(fs.readFileSync(errataPath, "utf8"))
            : new Map<number, Erratum[]>();

        const bookName = `Великие Четьи-Минеи (${month.title})`;
        console.log(`\n=== ${bookName} ===`);

        // Книга заводится один раз; `order` — в конец библиотеки, дальше её
        // двигают руками, и перетирать это значение прогоном нельзя.
        let book = await db.collection("books").findOne({ name: bookName });
        if (!book) {
            const last = await db.collection("books").find({}).sort({ order: -1 }).limit(1).toArray();
            const order = (last[0]?.order ?? 0) + 1;
            if (DRY_RUN) {
                console.log(`  [dry-run] завести книгу, order=${order}`);
                book = { _id: new ObjectId(), name: bookName, texts: [] } as any;
            } else {
                const res = await db.collection("books").insertOne({
                    name: bookName,
                    description: "Великие Минеи Четьи митрополита Макария. Расшифровка печатного издания, гражданский шрифт.",
                    author: "",
                    translator: "",
                    fileId: null,
                    texts: [],
                    language: LANGUAGE,
                    order,
                    updatedAt: new Date(),
                });
                book = await db.collection("books").findOne({ _id: res.insertedId });
                console.log(`  книга заведена, order=${order}`);
            }
        } else {
            console.log(`  книга уже есть (${book.texts?.length ?? 0} текстов)`);
        }

        const seenAliases: string[] = [];
        const unmatched: Array<{ day: number; page: string; printed: string }> = [];
        const multi: Array<{ day: number; page: string; printed: string; count: number }> = [];

        for (const file of dayFiles) {
            const day = parseInt(file.slice(0, 2), 10);
            const raw = fs.readFileSync(path.join(dir, file), "utf8");
            const { body, notes } = splitFile(raw);
            const noteMap = parseNotes(notes);
            const texts = parseBody(body, day);
            const dayErrata = errata.get(day) ?? [];

            // Каждая опечатка достаётся тексту, в котором нашлась её цитата.
            const errataFor = new Map<number, Erratum[]>();
            const haystack = new Map(
                texts.map((t) => [t.order, forSearch([t.heading, ...t.paragraphs].join(" ")).replace(/-/g, "")]),
            );
            for (const e of dayErrata) {
                const needles = searchCandidates(e.printed);
                const hits = texts.filter((t) =>
                    needles.some((n) => haystack.get(t.order)!.includes(n)),
                );
                // Цитата, найденная в нескольких текстах, — не двусмысленность, а
                // повтор: одно и то же слово книга даёт дважды, полной редакцией и
                // прологовой, и дефект набора сидит в обеих (`невкоем граде`,
                // с. 177 и 186). Заметка нужна каждому такому тексту, поэтому
                // раскладываем по всем совпадениям, а сам факт повтора печатаем —
                // чтобы случайное совпадение по короткой цитате было видно.
                if (hits.length === 0) {
                    unmatched.push({ day, page: e.page, printed: e.printed });
                    continue;
                }
                if (hits.length > 1) {
                    multi.push({ day, page: e.page, printed: e.printed, count: hits.length });
                }
                for (const h of hits) {
                    if (!errataFor.has(h.order)) errataFor.set(h.order, []);
                    errataFor.get(h.order)!.push(e);
                }
            }

            for (const t of texts) {
                // Заголовки в дне повторяются дословно: «слово о гневе» и
                // «наказание святаго Василиа» напечатаны дважды, двумя
                // редакциями. Различаем по месту в дне — оно устойчиво, и
                // повторный прогон даст тот же адрес.
                const base = `vmch-${String(month.num).padStart(2, "0")}-${String(day).padStart(2, "0")}-${slug(t.heading)}`;
                const twin = texts.filter((o) => slug(o.heading) === slug(t.heading));
                const alias = twin.length > 1 ? `${base}-${twin.indexOf(t) + 1}` : base;
                seenAliases.push(alias);

                // Сквозной номер дня → номер в массиве этого текста.
                const localOf = new Map<number, number>();
                t.footnoteRefs.forEach((n, i) => localOf.set(n, i + 1));
                const footnotes = t.footnoteRefs.map((n) => noteMap.get(n) ?? "");
                const missing = t.footnoteRefs.filter((n) => !noteMap.has(n));
                if (missing.length) {
                    console.log(`  ! ${alias}: нет пояснений к сноскам ${missing.join(", ")}`);
                }

                const content = normalizeParagraphs(
                    t.paragraphs
                        .map((p) => p.replace(/\[\^(\d+)\]/g, (_, n) => `{${localOf.get(parseInt(n, 10))}}`))
                        .join("\n\n"),
                );

                const own = errataFor.get(t.order) ?? [];
                const headingNotes = t.headingRefs.map((n) => noteMap.get(n)).filter(Boolean) as string[];
                const adminInfo = [
                    ...(own.length
                        ? ["Опечатки издания (в тексте НЕ исправлены):",
                           ...own.map((e) => `с. ${e.page}: ${e.printed}`
                               + (e.expected ? ` → ${e.expected}` : "")
                               + (e.doubtful ? " [сомнительное]" : ""))]
                        : []),
                    ...(headingNotes.length
                        ? ["", "Сноска издания к заголовку:", ...headingNotes]
                        : []),
                    ...(t.editorial.length ? ["", "Пометки расшифровщика:", ...t.editorial] : []),
                ].join("\n").trim();

                const doc = {
                    name: `${String(day).padStart(2, "0")} ${month.genitive} - ${t.heading}`,
                    content,
                    footnotes,
                    adminInfo,
                    alias,
                    bookIndex: day * 1000 + t.order * 10,
                    type: kindOf(t.heading),
                    readiness: READINESS,
                    bookId: book!._id,
                    description: "",
                    start: "",
                    author: "",
                    translator: "",
                    link: null,
                    ruLink: null,
                    poems: "",
                    images: [],
                    info: "",
                    updatedAt: new Date(),
                    importedFrom: { script: "import-vmch", file, day, heading: t.heading },
                };

                if (DRY_RUN) {
                    console.log(`  [dry-run] ${alias}  |  ${doc.name.slice(0, 70)}`
                        + `  | абз. ${t.paragraphs.length}, сносок ${footnotes.length}, опечаток ${own.length}`);
                    continue;
                }

                // Чужой alias — стоп, а не молчаливая перезапись: адрес /texts/{alias}
                // разрешается в один документ, и заняв его, мы спрятали бы чужой текст.
                const clash = await db.collection("texts").findOne({ alias, "importedFrom.script": { $ne: "import-vmch" } });
                if (clash) {
                    console.log(`  ! alias «${alias}» занят другим документом — текст пропущен`);
                    continue;
                }

                const res = await db.collection("texts").findOneAndUpdate(
                    { alias },
                    {
                        $set: { ...doc, ...buildSearchFields(doc) },
                        $setOnInsert: { createdAt: new Date() },
                    },
                    { upsert: true, returnDocument: "after" },
                );
                const id = (res as any)?._id ?? (res as any)?.value?._id;
                if (id) {
                    await db.collection("books").updateOne(
                        { _id: book!._id },
                        { $addToSet: { texts: id } },
                    );
                }
            }
            console.log(`  ${file}: ${texts.length} текстов, сносок ${noteMap.size}, опечаток ${dayErrata.length}`);
        }

        // Заведённое прошлым прогоном и пропавшее из источника.
        const stale = await db.collection("texts")
            .find({ bookId: book!._id, "importedFrom.script": "import-vmch", alias: { $nin: seenAliases } })
            .project({ alias: 1, name: 1 })
            .toArray();
        if (stale.length) {
            console.log(`  осталось от прошлых прогонов (${stale.length}):`);
            stale.forEach((s: any) => console.log(`    ${s.alias}  ${s.name}`));
            if (PRUNE && !DRY_RUN) {
                const ids = stale.map((s: any) => s._id);
                await db.collection("texts").deleteMany({ _id: { $in: ids } });
                await db.collection("books").updateOne({ _id: book!._id }, { $pull: { texts: { $in: ids } } } as any);
                console.log("    удалено (--prune)");
            } else if (!PRUNE) {
                console.log("    не удалено; для удаления — --prune");
            }
        }

        if (multi.length) {
            console.log(`  опечатки, попавшие сразу в несколько текстов (${multi.length}):`);
            multi.forEach((m) => console.log(`    ${m.day} день, с. ${m.page}: ${m.printed.slice(0, 60)} → ${m.count} текста`));
        }
        if (unmatched.length) {
            console.log(`  опечатки, не привязанные к тексту (${unmatched.length}):`);
            unmatched.forEach((u) => console.log(`    ${u.day} день, с. ${u.page}: ${u.printed.slice(0, 60)}`));
        }
    }

    await client.close();
};

run().catch((e) => { console.error(e); process.exit(1); });

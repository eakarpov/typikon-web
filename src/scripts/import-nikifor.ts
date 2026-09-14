// Заводит «Библейскую энциклопедию» архимандрита Никифора (Бажанова), М., 1891,
// из Викитеки (страницы «БЭАН/…»): книга в библиотеке, статья — текст.
//
// Сочинение — общественное достояние; текст вычитан участниками Викитеки. Разбор
// разметки — @/scripts/lib/bean. Перенаправления (их сотня) текстами не становятся:
// по ним ссылки между статьями ведут к цели.
//
// Зачем в корпусе. Энциклопедия даёт библейские места в русской традиционной
// форме («Вефиль», «Авана»), и страница места ссылается на статью о нём; ссылки на
// Писание в статьях — в славянской нумерации, их использует сопоставление с местами.
//
// Разметка кэшируется в script-data/nikifor/wikitext.json (каталог в .gitignore);
// чтобы перечитать Викитеку, удалите файл.
//
// Повторный прогон с --replace удаляет тексты этой книги и заводит заново с теми же
// алиасами: порядок статей и выдача алиасов устойчивы.
//
// Запуск:  npm run corpus:import-nikifor                 # отчёт, база не тронута
//          npm run corpus:import-nikifor -- --apply      # завести книгу (если её нет)
//          npm run corpus:import-nikifor -- --apply --replace
import "@/scripts/lib/env";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { buildSearchFields } from "@/lib/search";
import { slugify, uniqueAlias } from "@/lib/news/format";
import { parseArticle, Parsed, PREFIX, resolveLinks } from "@/scripts/lib/bean";

const APPLY = process.argv.includes("--apply");
const REPLACE = process.argv.includes("--replace");
const CACHE = path.join(process.cwd(), "script-data", "nikifor", "wikitext.json");
const API = "https://ru.wikisource.org/w/api.php";
const UA = "typikon-web/1.0 (corpus import, contact: georgecarpow@gmail.com)";

/** Книга находится по этому ключу, а не по названию: название редактор может поправить. */
const SOURCE_KEY = "wikisource:БЭАН";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const api = async (params: Record<string, string>) => {
    for (let attempt = 1; ; attempt++) {
        const res = await fetch(`${API}?${new URLSearchParams({ format: "json", formatversion: "2", maxlag: "5", ...params })}`, {
            headers: { "User-Agent": UA },
        });
        const body = res.ok ? await res.json() : null;
        if (body && !body.error) return body;
        if (attempt >= 5) throw new Error(`Викитека: ${res.status} ${JSON.stringify(body?.error ?? "")}`);
        await sleep(5000 * attempt);
    }
};

const loadWikitext = async (): Promise<Record<string, string>> => {
    if (existsSync(CACHE)) return JSON.parse(readFileSync(CACHE, "utf8"));
    const titles: string[] = [];
    let cont: Record<string, string> = {};
    do {
        const body = await api({ action: "query", list: "allpages", apprefix: PREFIX, aplimit: "500", ...cont });
        titles.push(...body.query.allpages.map((p: any) => p.title));
        cont = body.continue ?? {};
    } while (Object.keys(cont).length);

    const texts: Record<string, string> = {};
    for (let i = 0; i < titles.length; i += 50) {
        console.log(`  Викитека: ${i + 1}–${Math.min(i + 50, titles.length)} из ${titles.length}`);
        const body = await api({ action: "query", prop: "revisions", rvprop: "content", rvslots: "main", titles: titles.slice(i, i + 50).join("|") });
        for (const page of body.query.pages) texts[page.title] = page.revisions?.[0]?.slots?.main?.content ?? "";
        await sleep(500);
    }
    mkdirSync(path.dirname(CACHE), { recursive: true });
    writeFileSync(CACHE, JSON.stringify(texts));
    return texts;
};

async function main() {
    const wikitext = await loadWikitext();
    const parsed: Parsed[] = Object.keys(wikitext)
        .sort((a, b) => a.localeCompare(b, "ru"))
        .map((title) => parseArticle(title, wikitext[title]));

    // Статья без текста (в Викитеке заведена одна шапка, как «Наемник») текстом не становится.
    const all = parsed.filter((p): p is Extract<Parsed, { kind: "article" }> => p.kind === "article");
    const articles = all.filter((a) => a.content.length >= 3);
    const emptyInSource = all.filter((a) => a.content.length < 3).map((a) => a.name);
    const redirects = new Map(parsed.filter((p) => p.kind === "redirect").map((p: any) => [p.title.slice(PREFIX.length), p.target as string]));

    const db = (await clientPromise).db("typikon");
    const books = db.collection("books");
    const texts = db.collection("texts");
    const book = await books.findOne({ source: SOURCE_KEY });
    if (book && !REPLACE && APPLY) {
        console.log(`Книга уже заведена (${book._id}). Чтобы залить заново: --replace`);
        process.exit(1);
    }

    // Алиасы: занятые чужими текстами — нельзя; свои при --replace освобождаются.
    const taken = new Set<string>(
        (await texts.find(
            { alias: { $gt: "" }, ...(book ? { bookId: { $ne: book._id } } : {}) },
            { projection: { alias: 1 } },
        ).toArray()).map((t) => t.alias),
    );
    const aliasOfName = new Map<string, string>();
    for (const a of articles) {
        const alias = uniqueAlias(`nikifor-${slugify(a.name)}`, taken);
        taken.add(alias);
        aliasOfName.set(a.name, alias);
    }
    // Ссылки в Викитеке пишут заголовок с любым регистром первой буквы и через перенаправления.
    const lowerIndex = new Map([...aliasOfName].map(([name, alias]) => [name.toLowerCase(), alias]));
    const aliasOf = (article: string): string | undefined => {
        for (let name = article, hops = 0; hops < 3; hops++) {
            const found = aliasOfName.get(name) ?? lowerIndex.get(name.toLowerCase());
            if (found) return found;
            const next = redirects.get(name);
            if (!next) return undefined;
            name = next;
        }
        return undefined;
    };

    const unknown = new Map<string, number>();
    const unresolved = new Map<string, number>();
    let refs = 0, links = 0;
    const planned = articles.map((a, i) => {
        for (const t of a.unknownTemplates) unknown.set(t, (unknown.get(t) ?? 0) + 1);
        const resolved = resolveLinks(a.content, aliasOf);
        for (const u of resolved.unresolved) unresolved.set(u, (unresolved.get(u) ?? 0) + 1);
        refs += a.bibleRefs.length;
        links += a.links.length - resolved.unresolved.length;
        return { article: a, alias: aliasOfName.get(a.name)!, content: resolved.content, bookIndex: i + 1 };
    });

    console.log(`\n=== Разбор ===`);
    console.log(`Страниц: ${parsed.length}; статей: ${articles.length}, перенаправлений: ${redirects.size}, неоднозначностей: ${articles.filter((a) => a.disambiguation).length}`);
    console.log(`Знаков: ${planned.reduce((s, p) => s + p.content.length, 0)}; ссылок на Писание: ${refs}; ссылок между статьями: ${links}`);
    console.log(`Незнакомые шаблоны: ${unknown.size ? [...unknown].map(([k, n]) => `${k} ${n}`).join(", ") : "нет"}`);
    console.log(`Ссылки на отсутствующие статьи (развёрнуты в подпись): ${[...unresolved.values()].reduce((s, n) => s + n, 0)}`
        + (unresolved.size ? `; например: ${[...unresolved.keys()].slice(0, 8).join(", ")}` : ""));
    if (emptyInSource.length) console.log(`Пустых в источнике, пропущено: ${emptyInSource.length} (${emptyInSource.join(", ")})`);
    const sample = planned.find((p) => p.article.name === "Вефиль") ?? planned[0];
    console.log(`\nПример — ${sample.article.name} (${sample.alias}):\n${sample.content.slice(0, 500)}`);

    if (!APPLY) {
        console.log(`\nХолостой прогон, база не тронута. Записать: --apply`);
        process.exit(0);
    }

    const now = new Date();
    let bookId: ObjectId;
    if (book) {
        bookId = book._id;
        const removed = await texts.deleteMany({ bookId });
        console.log(`Удалено прежних текстов книги: ${removed.deletedCount}`);
    } else {
        const maxOrder = (await books.find({}, { projection: { order: 1 } }).sort({ order: -1 }).limit(1).toArray())[0]?.order ?? 0;
        bookId = (await books.insertOne({
            name: "Библейская энциклопедия",
            author: "архимандрит Никифор (Бажанов)",
            translator: "",
            description: "Иллюстрированная полная популярная библейская энциклопедия. М., 1891. "
                + "Текст по Викитеке (ru.wikisource.org, «Библейская энциклопедия архимандрита Никифора»); "
                + "сочинение — общественное достояние.",
            language: "ru",
            fileId: null,
            order: maxOrder + 1,
            texts: [],
            source: SOURCE_KEY,
            updatedAt: now,
        })).insertedId;
    }

    const docs = planned.map((p) => ({
        _id: new ObjectId(),
        name: p.article.name,
        alias: p.alias,
        content: p.content,
        description: "",
        start: "",
        fileId: null,
        link: null,
        // Не ссылка на Викитеку: страница чтения показывает ruLink как «Русский текст»,
        // то есть перевод, а статья и так русская. Источник назван в описании книги.
        ruLink: null,
        bookId,
        bookIndex: p.bookIndex,
        footnotes: [],
        csSource: false,
        newUi: true,
        type: "Reference",
        readiness: "ready",
        createdAt: now,
        updatedAt: now,
        ...buildSearchFields({ name: p.article.name, content: p.content } as any),
    }));
    for (let i = 0; i < docs.length; i += 500) await texts.insertMany(docs.slice(i, i + 500));
    await books.updateOne({ _id: bookId }, { $set: { texts: docs.map((d) => d._id), updatedAt: now } });

    console.log(`\nКнига ${bookId}: заведено текстов ${docs.length}.`);
    console.log(`Кэш сайта скрипт не сбрасывает; локально достаточно перезапустить dev-сервер.`);
    process.exit(0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});

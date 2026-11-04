import { chapterPlaces, textPlaces } from "@/lib/places/query";
import { bookLanguageLabel } from "@/utils/bookLanguages";
import { bookCategoryLabel } from "@/utils/libraryBooks";
import { BOOK_LABELS } from "@/utils/chantLabels";
import editorial from "@/data/study/relations.json";
import { BIBLE_CANON } from "@/utils/bibleCanon";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { aliasMatcher } from "@/lib/contentAliases";
import { getChant } from "@/lib/chants";
import {
  publicEditions,
  editionByCode,
  versesForCanonChapter,
} from "@/lib/bible/query";
import { getTextLinks } from "@/app/reading/[id]/api";
import { citationsOf, echoesOf, canonSortRange } from "@/lib/citations";
import { readingParts } from "@/lib/readingParts";
import {
  blocksOf,
  fingerprint,
  validateTarget,
  type Target,
  type Material,
} from "./core";
export const corpus = async () => (await clientPromise).db("typikon");
export async function catalog(bookId?: string) {
  const db = await corpus();
  const editions = await publicEditions(db);
  if (bookId) {
    const book = await db
      .collection("books")
      .findOne({ ...aliasMatcher(bookId), public: { $ne: false } });
    if (!book) throw Error("Книга недоступна.");
    const texts = await db
      .collection("texts")
      .aggregate([
        {
          $match: {
            $or: [{ bookId: book._id }, { _id: { $in: book.texts ?? [] } }],
            content: { $type: "string", $nin: ["", null] },
            readiness: { $in: ["ready", "correcting", "texted"] },
          },
        },
        {
          $project: {
            name: 1,
            alias: 1,
            bookIndex: 1,
            characters: { $strLenCP: "$content" },
          },
        },
        { $sort: { bookIndex: 1, _id: 1 } },
      ])
      .toArray();
    return {
      book: {
        id: String(book._id),
        title: book.name,
        author: book.author,
        language: book.language,
        languageLabel: bookLanguageLabel(book.language),
        edition: book.editionTitle,
        workKey: book.workKey,
        description: book.description,
      },
      texts: texts.map((t) => ({
        id: String(t._id),
        title: t.name,
        target: { kind: "text", id: String(t._id) },
        characters: t.characters ?? 0,
      })),
      editions: editions.map((e) => ({
        code: e.code,
        title: e.title,
        language: e.language,
      })),
    };
  }
  const books = await db
    .collection("books")
    .aggregate([
      { $match: { public: { $ne: false } } },
      {
        $lookup: {
          from: "texts",
          let: { id: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$bookId", "$$id"] },
                content: { $type: "string", $nin: ["", null] },
                readiness: { $in: ["ready", "correcting", "texted"] },
              },
            },
            { $count: "count" },
          ],
          as: "available",
        },
      },
      { $sort: { name: 1 } },
    ])
    .toArray();
  return {
    scriptureBooks: BIBLE_CANON.map((b) => ({ id: b.id, name: b.name })),
    books: books.map((b) => ({
      id: String(b._id),
      title: b.name,
      author: b.author,
      language: b.language,
      languageLabel: bookLanguageLabel(b.language),
      category: b.category,
      categoryLabel: bookCategoryLabel(b.category),
      workKey: b.workKey,
      edition: b.editionTitle,
      description: b.description,
      available: b.available[0]?.count ?? 0,
      bibleEdition: editions.find((e) => String(e.bookId) === String(b._id))
        ?.code,
    })),
    editions: editions.map((e) => ({
      code: e.code,
      title: e.title,
      language: e.language,
    })),
  };
}
export async function material(raw: Target): Promise<Material> {
  const t = validateTarget(raw),
    db = await corpus();
  if (t.kind === "text") {
    const text = await db.collection("texts").findOne(aliasMatcher(t.id));
    if (
      !text ||
      !text.content?.trim() ||
      !["ready", "correcting", "texted"].includes(text.readiness)
    )
      throw Error("Текст недоступен.");
    const book = text.bookId
      ? await db.collection("books").findOne({ _id: text.bookId })
      : null;
    if (book?.public === false) throw Error("Текст недоступен.");
    const id = String(text._id),
      edition = String(text.bookId ?? id);
    if (t.edition && t.edition !== edition)
      throw Error("Указано другое издание.");
    const content = t.statia
      ? readingParts(text.content)[t.statia - 1]
      : text.content;
    if (!content?.trim()) throw Error("Отрывок недоступен.");
    const footnotes = text.footnotes ?? [],
      markers = [...content.matchAll(/\{(\d+)}/g)].map((x) => Number(x[1])),
      footnoteBase = markers.includes(0) ? 0 : 1;
    const missing = [...new Set(markers)]
      .filter((n) => !footnotes[n - footnoteBase]?.trim())
      .map((n) => "Сноска " + n);
    return {
      target: {
        kind: "text",
        id,
        edition,
        ...(t.statia ? { statia: t.statia } : {}),
      },
      title: text.name,
      author: text.author ?? book?.author,
      edition: book?.editionTitle ?? book?.name,
      language: text.language ?? book?.language ?? "cu_gr",
      source: text.link ?? undefined,
      sourceHash: fingerprint(content),
      blocks: blocksOf(content),
      footnotes,
      metadata: {
        bookId: String(text.bookId ?? ""),
        workKey: book?.workKey,
        readiness: text.readiness,
        russianUrl: text.ruLink,
        description: book?.description,
        quotes: text.quotes ?? [],
        footnoteBase,
      },
      missing,
    };
  }
  if (t.kind === "bible") {
    const e = await editionByCode(db, t.edition!);
    if (!e || e.public === false) throw Error("Издание Писания недоступно.");
    const verses = await versesForCanonChapter(db, e._id, t.id, t.chapter!);
    const chosen = verses.filter(
      (v) =>
        v.canonVerse >= (t.verseFrom ?? 1) &&
        v.canonVerse <= (t.verseTo ?? 100000),
    );
    if (!chosen.length) throw Error("В выбранном издании нет этих стихов.");
    const blocks = verses.map((v, index) => ({
      id: "v-" + v.canonVerse,
      hash: fingerprint(v.content ?? ""),
      text: v.content ?? "",
      index,
      verse: v.canonVerse,
      editionChapter:v.chapter,editionVerse:v.verse,
    }));
    const missing = verses
      .filter((v) => !v.content?.trim())
      .map((v) => "Стих " + v.canonVerse);
    if (t.verseFrom && t.verseTo)
      for (let v = t.verseFrom; v <= t.verseTo; v++)
        if (!chosen.some((x) => x.canonVerse === v)) missing.push("Стих " + v);
    return {
      target: { kind: "bible", id: t.id, edition: e.code, chapter: t.chapter },
      title: `${BIBLE_CANON.find((b) => b.id === t.id)?.name ?? t.id} ${t.chapter}`,
      edition: e.title,
      source: e.sourceLink ?? undefined,
      language: e.language,
      sourceHash: fingerprint(blocks.map((b) => b.text).join("\n")),
      blocks,
      footnotes: [],
      metadata: {
        sourceLink: e.sourceLink,
        year: e.year,
        range: { from: t.verseFrom, to: t.verseTo },
      },
      missing,
    };
  }
  const chant = getChant(Number(t.id));
  if (!chant?.text) throw Error("Песнопение недоступно.");
  if (t.edition && t.edition !== chant.sourceBook)
    throw Error("Указано другое издание песнопения.");
  return {
    target: {
      kind: "chant",
      id: String(chant.id),
      ...(chant.sourceBook ? { edition: chant.sourceBook } : {}),
    },
    title: chant.position ?? chant.unit,
    edition:
      BOOK_LABELS[chant.sourceBook ?? ""] ?? chant.sourceBook ?? undefined,
    language: chant.language,
    sourceHash: fingerprint(chant.text),
    blocks: blocksOf(chant.text),
    footnotes: [],
    metadata: {
      memory: chant.memory,
      service: chant.service,
      sourceBook: chant.sourceBook,
      textItemId: chant.textItemId,
    },
    missing: [],
  };
}
export async function related(t: Target) {
  const db = await corpus(),
    m = await material(t);
  const stored = await db
    .collection("studyRelations")
    .find({
      status: "checked",
      $or: [
        { "from.kind": m.target.kind, "from.id": m.target.id },
        { "to.kind": m.target.kind, "to.id": m.target.id },
      ],
    })
    .limit(200)
    .toArray();
  const relations = [...editorial.relations, ...stored]
    .filter((r) => {
      const a =
        r.from.kind === t.kind && r.from.id === m.target.id ? r.from : r.to;
      return (
        (!a.sourceHash || a.sourceHash === m.sourceHash) &&
        (!a.edition || a.edition === m.target.edition) &&
        (!a.chapter || a.chapter === t.chapter) &&
        (!a.blockId || !t.blockId || a.blockId === t.blockId) &&
        (!a.verseFrom ||
          !t.verseFrom ||
          (a.verseFrom <= (t.verseTo ?? t.verseFrom) &&
            a.verseTo >= t.verseFrom))
      );
    })
    .map((r) => ({ ...r, _id: undefined, id: String((r as any)._id ?? r.id) }));
  let places: any[] = [],
    memory: any = null,
    echoes: any[] = [],
    scripture: any[] = [],
    editions: any[] = [];
  if (t.kind === "text") {
    const text = await db
      .collection("texts")
      .findOne({ _id: new ObjectId(m.target.id) });
    if (text) {
      memory = await getTextLinks({ ...text, id: String(text._id) });
      places = (
        await textPlaces(String(text._id), text.content ?? "", text.alias)
      ).filter((p) => p.href);
    }
    if (m.metadata.workKey)
      editions = (
        await db
          .collection("books")
          .find(
            { workKey: m.metadata.workKey, public: { $ne: false } },
            { projection: { name: 1, editionTitle: 1, language: 1 } },
          )
          .toArray()
      ).map((b) => ({
        id: String(b._id),
        title: b.editionTitle ?? b.name,
        language: b.language,
        alignment: false,
      }));
  }
  if (t.kind === "bible") {
    places = (await chapterPlaces(t.id, t.chapter!)).filter((p) => p.href);
    const range = canonSortRange(t.chapter!, t.verseFrom);
    echoes =
      echoesOf(
        t.id,
        range[0],
        t.verseTo ? canonSortRange(t.chapter!, t.verseTo)[1] : range[1],
        {},
        30,
        0,
      )?.items ?? [];
  }
  if (t.kind === "chant")
    scripture = (
      citationsOf(Number(m.metadata.textItemId ?? t.id)) ?? []
    ).filter((c: any) => c.confidence === "certain");
  return {
    relations,
    memory,
    places,
    echoes,
    scripture,
    editions,
    notice:
      "Показаны подготовленные связи; отсутствие результата не означает отсутствия материалов.",
  };
}
/** An explicitly selected excerpt for the existing personal reading-plan reader. */
export async function readingFragment(t: Target) {
  const m = await material(t);
  let content: string;
  if (t.quote) {
    const found = (await import("./core")).locate(m, t);
    if (!found) throw Error("Источник изменился: уточните место в подборке.");
    content = t.quote;
  } else {
    const blocks =
      t.kind === "bible" && t.verseFrom
        ? m.blocks.filter(
            (b) =>
              b.verse! >= t.verseFrom! &&
              b.verse! <= (t.verseTo ?? t.verseFrom!),
          )
        : m.blocks;
    content = blocks.map((b) => b.text).join("\n\n");
  }
  return {
    content,
    footnotes: m.footnotes,
    markdown: true,
    csSource: m.language === "cu",
    language: m.language,
    missing: m.missing,
  };
}

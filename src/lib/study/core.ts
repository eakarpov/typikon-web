/** Shared wire model. Anchors refer to the source, never a transformed display. */
export interface Target {
  kind: "text" | "bible" | "chant";
  id: string;
  edition?: string;
  chapter?: number;
  verseFrom?: number;
  verseTo?: number;
  blockId?: string;
  endBlockId?: string;
  quote?: string;
  prefix?: string;
  suffix?: string;
  sourceHash?: string;
  occurrence?: number;
  statia?: number;
}
export interface Block {
  id: string;
  hash: string;
  text: string;
  index: number;
  heading?: boolean;
  verse?: number;
  editionChapter?: number;
  editionVerse?: number;
}
export interface Material {
  target: Target;
  title: string;
  author?: string;
  edition?: string;
  language: string;
  source?: string;
  sourceHash: string;
  blocks: Block[];
  footnotes: string[];
  metadata: Record<string, unknown>;
  missing: string[];
}
export interface RecordDoc {
  id: string;
  revision: number;
  kind: "highlight" | "note" | "question";
  target: Target;
  note: string;
  tags: string[];
  questionStatus: "open" | "resolved";
  updatedAt?: string;
  legacy?: boolean;
  unresolved?: boolean;
  sourceTitle?: string;
  sourceBookId?: string;
  sourceBookTitle?: string;
  originalQuote?: string;
  originalTarget?: Target;
}
export interface StudyItem {
  id: string;
  kind: "source" | "section" | "record";
  title: string;
  target?: Target;
  recordId?: string;
  comment?: string;
  href?: string;
  textId?: string;
  statia?: number;
}
export interface Notebook {
  id: string;
  revision: number;
  title: string;
  description?: string;
  items: StudyItem[];
  routeId?: string;
}
export interface Position {
  id: string;
  revision: number;
  target: Target;
  title: string;
  status?: "reading" | "deferred" | "read";
  collectionId?: string;
  itemId?: string;
  updatedAt?: string;
}
export interface Personal {
  records: RecordDoc[];
  collections: Notebook[];
  positions: Position[];
  links: any[];
}
export const emptyPersonal = (): Personal => ({
  records: [],
  collections: [],
  positions: [],
  links: [],
});
export const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[іiѵ]/g, "и")
    .replace(/ѣ/g, "е")
    .replace(/ς/g, "σ")
    .replace(/\s+/g, " ")
    .trim();
// Portable FNV-1a over UTF-16; Dart implements exactly the same operation.
export function fingerprint(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
export function blocksOf(content: string): Block[] {
  const counts = new Map<string, number>();
  return content
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n|\n(?=#{1,6}\s)/)
    .filter((s) => s.trim())
    .map((text, index) => {
      text = text.trim();
      const hash = fingerprint(text),
        n = counts.get(hash) ?? 0;
      counts.set(hash, n + 1);
      return {
        id: `b-${hash}-${n}`,
        hash,
        text,
        index,
        heading: /^#{1,6}\s/.test(text),
      };
    });
}
export function validateTarget(raw: unknown): Target {
  const t = raw as Target;
  if (
    !t ||
    !["text", "bible", "chant"].includes(t.kind) ||
    typeof t.id !== "string" ||
    !/^[-\w.:]{1,160}$/.test(t.id)
  )
    throw Error("Неверный адрес источника.");
  const out: Target = { kind: t.kind, id: t.id };
  for (const k of ["edition", "blockId", "endBlockId", "sourceHash"] as const)
    if (t[k] != null) {
      if (typeof t[k] !== "string" || !/^[-\w.:]{1,180}$/.test(t[k]!))
        throw Error("Неверное издание или место.");
      out[k] = t[k];
    }
  for (const k of [
    "chapter",
    "verseFrom",
    "verseTo",
    "occurrence",
    "statia",
  ] as const)
    if (t[k] != null) {
      if (
        !Number.isInteger(t[k]) ||
        t[k]! < (k === "occurrence" ? 0 : 1) ||
        t[k]! > 100000
      )
        throw Error("Неверный диапазон.");
      out[k] = t[k];
    }
  for (const k of ["quote", "prefix", "suffix"] as const)
    if (t[k] != null) {
      if (
        typeof t[k] !== "string" ||
        t[k]!.length > (k === "quote" ? 20000 : 240)
      )
        throw Error("Слишком длинная выписка.");
      out[k] = t[k];
    }
  if (
    t.kind === "bible" &&
    (!t.chapter ||
      !t.edition ||
      (t.verseTo ?? t.verseFrom ?? 1) < (t.verseFrom ?? 1))
  )
    throw Error("Укажите издание и диапазон Писания.");
  return out;
}
export function locate(
  m: Material,
  t: Target,
): { block: Block; exact: boolean; offset?: number; endBlock?: Block } | null {
  if (
    m.target.kind !== t.kind ||
    m.target.id !== t.id ||
    (t.edition && m.target.edition !== t.edition) ||
    (t.statia ?? 0) !== (m.target.statia ?? 0) ||
    (t.kind === "bible" && t.chapter !== m.target.chapter)
  )
    return null;
  const offsets = (text: string) => {
    const out: { at: number; ordinal: number }[] = [];
    if (!t.quote) return out;
    let at = -1,
      ordinal = 0;
    while ((at = text.indexOf(t.quote, at + 1)) !== -1) {
      if (
        (!t.prefix || text.slice(0, at).endsWith(t.prefix)) &&
        (!t.suffix || text.slice(at + t.quote.length).startsWith(t.suffix))
      )
        out.push({ at, ordinal });
      ordinal++;
    }
    return out;
  };
  if (t.endBlockId) {
    const start = m.blocks.findIndex((b) => b.id === t.blockId),
      end = m.blocks.findIndex((b) => b.id === t.endBlockId);
    if (start < 0 || end < start) return null;
    const body = m.blocks
      .slice(start, end + 1)
      .map((b) => b.text)
      .join("\n\n");
    if (t.quote && !body.includes(t.quote)) return null;
    if (
      t.sourceHash !== m.sourceHash &&
      [m.blocks[start], m.blocks[end]].some(
        (b) => m.blocks.filter((x) => x.hash === b.hash).length > 1,
      )
    )
      return null;
    return {
      block: m.blocks[start],
      endBlock: m.blocks[end],
      exact: true,
      offset: t.quote ? body.indexOf(t.quote) : 0,
    };
  }
  const find = (block: Block, stable: boolean) => {
    if (!t.quote) return { block, exact: true, offset: 0 };
    const matches = offsets(block.text);
    const hit =
      matches.length === 1
        ? matches[0]
        : stable && t.occurrence != null
          ? matches.find((x) => x.ordinal === t.occurrence)
          : undefined;
    return hit ? { block, exact: true, offset: hit.at } : null;
  };
  if (t.kind === "bible" && t.verseFrom) {
    const block = m.blocks.find((b) => b.verse === t.verseFrom);
    return block ? find(block, true) : null;
  }
  if (t.blockId) {
    const block = m.blocks.find((b) => b.id === t.blockId);
    if (block) {
      if (
        t.sourceHash !== m.sourceHash &&
        m.blocks.filter((b) => b.hash === block.hash).length > 1
      )
        return null;
      const found = find(block, true);
      if (found) return found;
    }
  }
  const hits = m.blocks.flatMap((block) =>
    offsets(block.text).map((hit) => ({ block, exact: true, offset: hit.at })),
  );
  return hits.length === 1 ? hits[0] : null;
}
export function rangeTarget(m: Material, from: string, to: string): Target {
  const a = m.blocks.findIndex((b) => b.id === from),
    b = m.blocks.findIndex((b) => b.id === to);
  if (a < 0 || b < a)
    throw Error(
      "Конец отрывка должен быть после его начала в том же источнике.",
    );
  const blocks = m.blocks.slice(a, b + 1),
    quote = blocks.map((b) => b.text).join("\n\n");
  if (quote.length > 20000)
    throw Error("Отрывок слишком большой. Сохраните его несколькими частями.");
  return {
    ...m.target,
    blockId: blocks[0].id,
    endBlockId: blocks[blocks.length - 1].id,
    sourceHash: m.sourceHash,
    quote,
    prefix: "",
    suffix: "",
    ...(m.target.kind === "bible"
      ? { verseFrom: blocks[0].verse, verseTo: blocks[blocks.length - 1].verse }
      : {}),
  };
}
export function targetAt(
  m: Material,
  b: Block,
  quote?: string,
  offset?: number,
): Target {
  const q = quote ?? b.text.slice(0, 2000);
  const at = offset ?? b.text.indexOf(q);
  return {
    ...m.target,
    blockId: b.id,
    sourceHash: m.sourceHash,
    occurrence: q
      ? (() => {
          let n = 0,
            i = -1;
          while ((i = b.text.indexOf(q, i + 1)) !== -1 && i < at) n++;
          return n;
        })()
      : 0,
    ...(b.verse ? { verseFrom: b.verse, verseTo: b.verse } : {}),
    quote: q,
    prefix: b.text.slice(Math.max(0, at - 80), at),
    suffix: b.text.slice(at + q.length, at + q.length + 80),
  };
}
export function targetKey(t: Target) {
  return [t.kind, t.id, t.edition ?? "", t.chapter ?? "", t.statia ?? ""].join(
    ":",
  );
}
export function href(t: Target) {
  return "/study?target=" + encodeURIComponent(JSON.stringify(t));
}
export const bounded = (s: unknown, max = 10000) => {
  if (typeof s !== "string" || s.length > max)
    throw Error("Неверный или слишком длинный текст.");
  return s;
};
export function validateEntity(kind: string, raw: any): any {
  if (!raw || typeof raw.id !== "string" || !/^[-\w]{1,100}$/.test(raw.id))
    throw Error("Неверный идентификатор записи.");
  if (kind === "records") {
    const target = validateTarget(raw.target);
    if (!["highlight", "note", "question"].includes(raw.kind))
      throw Error("Неверный вид записи.");
    return {
      id: raw.id,
      target,
      kind: raw.kind,
      note: bounded(raw.note ?? ""),
      ...(raw.originalTarget
        ? { originalTarget: validateTarget(raw.originalTarget) }
        : {}),
      ...(raw.originalQuote
        ? { originalQuote: bounded(raw.originalQuote, 20000) }
        : {}),
      tags: (Array.isArray(raw.tags) ? raw.tags : [])
        .slice(0, 30)
        .map((v: unknown) => bounded(v, 80)),
      questionStatus: raw.questionStatus === "resolved" ? "resolved" : "open",
      ...(raw.sourceTitle
        ? { sourceTitle: bounded(raw.sourceTitle, 300) }
        : {}),
      ...(raw.sourceBookId
        ? { sourceBookId: bounded(raw.sourceBookId, 160) }
        : {}),
      ...(raw.sourceBookTitle
        ? { sourceBookTitle: bounded(raw.sourceBookTitle, 300) }
        : {}),
    };
  }
  if (kind === "collections") {
    const title = bounded(raw.title, 120).trim();
    if (!title || !Array.isArray(raw.items) || raw.items.length > 200)
      throw Error("Укажите название и не более 200 элементов.");
    const items = raw.items.map((i: any) => {
      if (
        !i ||
        !/^[-\w]{1,100}$/.test(i.id) ||
        !["source", "section", "record"].includes(i.kind)
      )
        throw Error("Неверный элемент подборки.");
      return {
        id: i.id,
        kind: i.kind,
        title: bounded(i.title, 300),
        comment: bounded(i.comment ?? ""),
        ...(i.kind === "source" ? { target: validateTarget(i.target) } : {}),
        ...(i.kind === "record" ? { recordId: bounded(i.recordId, 100) } : {}),
      };
    });
    if (new Set(items.map((i: any) => i.id)).size !== items.length)
      throw Error("Повторяющийся идентификатор элемента.");
    return {
      id: raw.id,
      title,
      description: bounded(raw.description ?? ""),
      items,
      ...(raw.routeId ? { routeId: bounded(raw.routeId, 100) } : {}),
    };
  }
  if (kind === "positions") {
    if (!["reading", "deferred", "read", undefined].includes(raw.status))
      throw Error("Неверный статус.");
    return {
      id: raw.id,
      target: validateTarget(raw.target),
      title: bounded(raw.title, 300),
      status: raw.status ?? "reading",
      ...(raw.collectionId
        ? {
            collectionId: bounded(raw.collectionId, 100),
            itemId: bounded(raw.itemId ?? "", 100),
          }
        : {}),
    };
  }
  if (kind === "links")
    return {
      id: raw.id,
      from: validateTarget(raw.from),
      to: validateTarget(raw.to),
      note: bounded(raw.note ?? ""),
      origin: "personal",
    };
  throw Error("Неизвестный вид данных.");
}
export function exportMarkdown(p: Personal) {
  return [
    "# Моё чтение",
    ...p.collections.flatMap((c) => [
      "## " + c.title,
      c.description ?? "",
      ...c.items.map((i) =>
        i.kind === "section"
          ? "### " + i.title
          : `- [${i.title}](${i.target ? href(i.target) : ""})\n${i.comment ?? ""}`,
      ),
    ]),
    ...p.records.flatMap((r) => [
      "## " +
        (r.kind === "question"
          ? "Вопрос"
          : r.kind === "highlight"
            ? "Выписка"
            : "Заметка"),
      "> " + (r.originalQuote ?? r.target.quote ?? "").replace(/\n/g, "\n> "),
      r.note,
      "Источник выписки: " + href(r.originalTarget ?? r.target),
      ...(r.originalTarget &&
      JSON.stringify(r.originalTarget) !== JSON.stringify(r.target)
        ? ["Уточнённое место: " + href(r.target)]
        : []),
    ]),
  ].join("\n\n");
}

/** Context identity is checked before chapter/verse ranges: equal numbers are not a relation. */
export function relationAt(
  relation: { from: Target; to: Target },
  m: Material,
  selected: Target,
): { side: "from" | "to"; other: Target } | null {
  const matches = (a: Target) => {
    if (
      a.kind !== m.target.kind ||
      a.id !== m.target.id ||
      (a.edition && a.edition !== m.target.edition) ||
      (a.statia ?? 0) !== (m.target.statia ?? 0) ||
      (a.chapter != null && a.chapter !== m.target.chapter) ||
      (a.sourceHash && a.sourceHash !== m.sourceHash)
    )
      return false;
    if (
      a.verseFrom &&
      selected.verseFrom &&
      ((a.verseTo ?? a.verseFrom) < selected.verseFrom ||
        a.verseFrom > (selected.verseTo ?? selected.verseFrom))
    )
      return false;
    if (a.blockId && selected.blockId) {
      const index = (id: string) => m.blocks.findIndex((b) => b.id === id),
        a0 = index(a.blockId),
        a1 = index(a.endBlockId ?? a.blockId),
        s0 = index(selected.blockId),
        s1 = index(selected.endBlockId ?? selected.blockId);
      if (Math.min(a0, a1, s0, s1) < 0 || a1 < s0 || a0 > s1) return false;
    }
    return true;
  };
  return matches(relation.from)
    ? { side: "from", other: relation.to }
    : matches(relation.to)
      ? { side: "to", other: relation.from }
      : null;
}

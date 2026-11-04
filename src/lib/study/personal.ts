import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import {
  validateEntity,
  validateTarget,
  locate,
  href,
  type Personal,
  type Notebook,
  type Target,
} from "./core";
import { material } from "./material";
const db = async () => (await clientPromise).db("typikon-users");
const stores = {
  records: "userNotes",
  collections: "readingCollections",
  positions: "studyPositions",
  links: "studyLinks",
} as const;
function external(kind: string, d: any): any {
  const id = String(d.id ?? d._id),
    revision = d.revision ?? 0;
  if (kind === "records") {
    const s = typeof d.selection === "object" ? d.selection : {};
    return {
      id,
      revision,
      kind: d.kind ?? "note",
      target: d.target ?? {
        kind: "text",
        id: String(d.textId ?? "").split("#")[0],
        quote: s.phrase ?? "",
        ...(s.paragraph ? { prefix: "", suffix: "" } : {}),
      },
      note: d.note ?? "",
      tags: d.tags ?? [],
      questionStatus: d.questionStatus ?? "open",
      updatedAt: d.updatedAt,
      legacy: !d.target || d.bindingStatus === "legacy",
      unresolved: !d.target || d.bindingStatus === "legacy",
      originalTarget: d.originalTarget ??
        d.target ?? {
          kind: "text",
          id: String(d.textId ?? "").split("#")[0],
          quote: s.phrase ?? "",
        },
      originalQuote: d.originalQuote ?? d.target?.quote ?? s.phrase,
      sourceTitle: d.textName ?? d.sourceTitle,
      sourceBookId: d.sourceBookId,
      sourceBookTitle: d.sourceBookTitle,
    };
  }
  if (kind === "collections")
    return {
      id,
      revision,
      title: d.title,
      description: d.description ?? "",
      routeId: d.routeId,
      items: (d.items ?? []).map((i: any, n: number) =>
        i.target || i.kind
          ? i
          : {
              id: `legacy-${n}`,
              kind: "source",
              title: i.title,
              target: {
                kind: "text",
                id: i.textId,
                ...(i.statia ? { statia: i.statia } : {}),
              },
              href: i.href,
              textId: i.textId,
              statia: i.statia,
            },
      ),
    };
  const { _id, userId, opReceipts, deleted, ...body } = d;
  return { ...body, id, revision };
}
export async function personal(userId: string): Promise<Personal> {
  const d = await db(),
    out: any = {};
  for (const [kind, col] of Object.entries(stores)) {
    const rows = await d
      .collection(col)
      .find({ userId, deleted: { $ne: true } })
      .sort({ updatedAt: -1 })
      .toArray();
    out[kind] = rows.map((r) => external(kind, r));
  }
  const marks = await d
    .collection("readingProgress")
    .find({ userId })
    .sort({ updatedAt: -1 })
    .toArray();
  out.legacyPositions = marks.map((p) => ({
    id: String(p._id),
    textId: p.textId,
    paragraph: p.paragraph,
    total: p.total,
    href: "/reading/" + p.textId,
  }));
  const ids = out.records
    .filter((r: any) => ObjectId.isValid(r.target.id))
    .map((r: any) => new ObjectId(r.target.id));
  if (ids.length) {
    const texts = await (
      await clientPromise
    )
      .db("typikon")
      .collection("texts")
      .find({ _id: { $in: ids } }, { projection: { name: 1, bookId: 1 } })
      .toArray();
    const names = new Map(texts.map((t) => [String(t._id), t]));
    for (const r of out.records) {
      const t = names.get(r.target.id);
      r.sourceTitle ??= t?.name;
      r.sourceBookId ??= t?.bookId ? String(t.bookId) : undefined;
    }
  }
  return out;
}
export async function mutate(userId: string, b: any) {
  const kind = b.entity as keyof typeof stores;
  if (
    !Object.hasOwn(stores, kind) ||
    typeof b.opId !== "string" ||
    !/^[-\w]{8,100}$/.test(b.opId) ||
    !Number.isInteger(b.revision)
  )
    throw Error("Неверная операция.");
  const value = validateEntity(kind, b.value),
    d = await db(),
    col = d.collection(stores[kind]);
  const query = {
    userId,
    $or: [
      { id: value.id },
      ...(/^[a-f0-9]{24}$/i.test(value.id)
        ? [{ _id: new ObjectId(value.id) }]
        : []),
      { _id: value.id as any },
    ],
  };
  const old: any = await col.findOne(query);
  if (old?.opReceipts?.includes(b.opId)) return external(kind, old);
  if ((old?.revision ?? 0) !== b.revision)
    throw Object.assign(Error("conflict"), {
      remote: old ? external(kind, old) : null,
    });
  if (!old && b.revision !== 0) throw Error("conflict");
  if (old?.deleted && !b.restore) throw Error("Запись удалена.");
  if (kind === "records" && !b.deleted) {
    value.originalTarget =
      old?.originalTarget ??
      old?.target ??
      (old?.textId
        ? {
            kind: "text",
            id: String(old.textId).split("#")[0],
            quote: old.selection?.phrase ?? "",
          }
        : (value.originalTarget ?? value.target));
    value.originalQuote =
      old?.originalQuote ??
      old?.target?.quote ??
      old?.selection?.phrase ??
      value.originalQuote ??
      value.target.quote;
    const legacy =
      old &&
      !old.target &&
      value.target.kind === "text" &&
      value.target.id === String(old.textId).split("#")[0] &&
      !value.target.blockId;
    if (legacy) value.bindingStatus = "legacy";
    else if (
      !old ||
      JSON.stringify(old.target) !== JSON.stringify(value.target)
    ) {
      const m = await material(value.target);
      value.target = { ...value.target, ...m.target };
      if (value.target.quote && !locate(m, value.target))
        throw Error(
          "Не удалось подтвердить место выписки. Откройте источник и уточните привязку.",
        );
      value.bindingStatus = "exact";
      value.textName = m.title;
      value.sourceTitle = m.title;
      value.sourceBookId = m.metadata.bookId;
      value.sourceBookTitle = m.edition;
      value.textId =
        m.target.kind === "text"
          ? m.target.id
          : `${m.target.kind}:${m.target.id}`;
      value.selection = {
        type: m.target.kind === "bible" ? "verse" : "paragraph",
        phrase: value.target.quote ?? "",
        chapter: value.target.chapter,
        verse: value.target.verseFrom,
      };
    }
  }

  if (kind === "collections") {
    if (
      !old &&
      (await col.countDocuments({ userId, deleted: { $ne: true } })) >= 100
    )
      throw Error("Можно сохранить до 100 подборок.");
    value.items = value.items.map((i: any) => ({
      ...i,
      href: i.target ? href(i.target) : "/study?tab=mine",
      ...(i.target?.kind === "text" ? { textId: i.target.id } : {}),
    }));
    value.studyVersion = 1;
  }
  const next = {
    ...old,
    ...value,
    userId,
    revision: (old?.revision ?? 0) + 1,
    opReceipts: [...(old?.opReceipts ?? []), b.opId].slice(-200),
    updatedAt: new Date(),
    createdAt: old?.createdAt ?? new Date(),
    deleted: !!b.deleted,
  };
  if (old) {
    const version =
      old.revision === undefined
        ? { revision: { $exists: false } }
        : { revision: old.revision };
    const r = await col.replaceOne({ _id: old._id, userId, ...version }, next);
    if (!r.matchedCount) throw Error("conflict");
  } else {
    next._id =
      kind === "records" && /^[a-f0-9]{24}$/i.test(value.id)
        ? new ObjectId(value.id)
        : value.id;
    try {
      await col.insertOne(next);
    } catch (e) {
      if ((e as any).code === 11000) throw Error("conflict");
      throw e;
    }
  }
  return external(kind, next);
}
export async function publish(userId: string, b: any) {
  const d = await db(),
    col = await d.collection("readingCollections").findOne({
      userId,
      id: b.id,
      revision: b.revision,
      deleted: { $ne: true },
    });
  if (!col) throw Error("conflict");
  if (b.action === "unpublish") {
    await d
      .collection("readingCollectionShares")
      .deleteMany({ userId, collectionId: b.id });
    return {};
  }
  const selected = new Set(Array.isArray(b.recordIds) ? b.recordIds : []),
    p = await personal(userId);
  const c = external("collections", col) as Notebook;
  const items = [];
  for (const item of c.items) {
    if (item.kind === "record") {
      if (!selected.has(item.recordId)) continue;
      const r = p.records.find((r) => r.id === item.recordId);
      if (!r) continue;
      const m = await material(r.target);
      if (r.unresolved || (r.target.quote && !locate(m, r.target)))
        throw Error("Уточните место выбранной записи перед публикацией.");
      if (r.originalTarget) await material(r.originalTarget);
      items.push({
        ...item,
        record: {
          kind: r.kind,
          target: r.target,
          originalQuote: r.originalQuote,
          originalTarget: r.originalTarget,
          note: r.note,
        },
      });
    } else {
      if (item.target) await material(item.target);
      items.push(item);
    }
  }
  const token = crypto.randomUUID();
  await d.collection("readingCollectionShares").insertOne({
    _id: token as any,
    userId,
    collectionId: c.id,
    title: c.title,
    description: c.description,
    items,
    studyVersion: 1,
    createdAt: new Date(),
  });
  return { token, href: "/study/shared/" + token };
}
export async function shared(token: string): Promise<any> {
  if (!/^[a-f0-9-]{36}$/.test(token)) throw Error("Неверная ссылка.");
  const d = await (await db())
    .collection("readingCollectionShares")
    .findOne({ _id: token as any });
  if (!d) return null;
  const { userId, collectionId, _id, ...out } = d;
  const items = [];
  for (const item of out.items ?? []) {
    const t = item.target ?? item.record?.target;
    if (t)
      try {
        await material(t);
        if (item.record?.originalTarget)
          await material(item.record.originalTarget);
      } catch {
        items.push({
          id: item.id,
          title: item.title,
          comment: "Источник больше недоступен для публичной выдачи.",
        });
        continue;
      }
    items.push(item);
  }
  return { ...out, items };
}
export async function notebookPlan(userId: string, b: any) {
  const d = await db();
  const c = await d.collection("readingCollections").findOne({
    userId,
    id: b.id,
    revision: b.revision,
    deleted: { $ne: true },
  });
  if (!c)
    throw Error("Подборка изменилась. Обновите её перед созданием плана.");
  const old = await d
    .collection("readingPlans")
    .findOne({ _id: userId as any });
  const notebook = external("collections", c) as Notebook,
    sources = notebook.items.filter((i) => i.kind === "source" && i.target);
  if (!sources.length) throw Error("В подборке нет текстов для личного плана.");
  if (b.action === "preview")
    return {
      title: notebook.title,
      items: sources.map((i) => ({ title: i.title, target: i.target })),
      excludedRecords: notebook.items.filter((i) => i.kind === "record").length,
      existingPlan: old ? { title: old.title, id: old.id } : null,
    };
  if (
    b.action !== "create" ||
    typeof b.date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(b.date) ||
    !Number.isFinite(Date.parse(b.date)) ||
    new Date(b.date).toISOString().slice(0, 10) !== b.date
  )
    throw Error("Укажите дату начала.");
  if (old) {
    if (
      old.sourceCollectionId === notebook.id &&
      old.sourceCollectionRevision === notebook.revision
    )
      return { id: old.id, alreadyCreated: true };
    throw Error(
      "У вас уже есть личный план. Сначала завершите или удалите его в разделе плана; текущий план не заменён.",
    );
  }
  for (const i of sources)
    await (await import("./material")).readingFragment(i.target!);
  const plan = {
    _id: userId as any,
    id: crypto.randomUUID(),
    revision: 0,
    kind: "collection",
    title: notebook.title,
    status: "active",
    cursor: 0,
    date: b.date,
    sourceCollectionId: notebook.id,
    sourceCollectionRevision: notebook.revision,
    units: sources.map((i) => ({
      key: i.id,
      title: i.title,
      href: href(i.target!),
      studyTarget: i.target,
    })),
  };
  try {
    await d.collection("readingPlans").insertOne(plan);
  } catch (e) {
    if ((e as any).code === 11000)
      throw Error(
        "Личный план уже создан. Откройте его; повторная копия не добавлена.",
      );
    throw e;
  }
  return { id: plan.id, href: "/reading-plan" };
}

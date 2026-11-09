"use client";
import NoteSharing from "@/app/components/NoteSharing";
import TextLinkList from "@/app/components/TextLinkList";
import Comparison, { type ComparisonData } from "./Comparison";
import { showHighlights } from "./highlights";
import { bookLanguageLabel } from "@/utils/bookLanguages";
import { bookCategoryLabel } from "@/utils/libraryBooks";
import { BIBLE_CANON } from "@/utils/bibleCanon";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Markdown from "react-markdown";
import ReadingFocus from "@/app/components/ReadingFocus";
import { savePage } from "@/lib/offline";
import { readCache, writeCache, savedMaterials } from "@/lib/study/cache";
import {
  queueOperation,
  emptyPersonal,
  exportMarkdown,
  href,
  locate,
  rangeTarget,
  normalize,
  targetAt,
  targetKey,
  validateEntity,
  type Material,
  type Target,
  type Personal,
  type Block,
  type Notebook,
  type RecordDoc,
} from "@/lib/study/core";
import { myFont, csFontVariables } from "@/utils/font";
const button = "border rounded px-3 py-2 min-h-11 disabled:opacity-50";
const field = "border rounded p-2 w-full bg-transparent";
const id = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(12)), (v) =>
    v.toString(16).padStart(2, "0"),
  ).join("");
const relationNames: Record<string, string> = {
  scripture: "Писание",
  commentary: "Толкования",
  citation: "Цитируется в текстах",
  topic: "По теме",
  alignment: "Другие редакции",
};
function PlainSource({
  text,
  onFootnote,
}: {
  text: string;
  onFootnote?: (n: number) => void;
}) {
  return (
    <div
      style={{
        fontFamily:
          /[\u0460-\u052f\u2de0-\u2dff\ua640-\ua69f\u1c80-\u1c8f]/u.test(text)
            ? "var(--cs-font, var(--font-ponomar))"
            : undefined,
      }}
    >
      <Markdown
        components={{
          a: ({ href, children }) =>
            href?.startsWith("#study-footnote-") ? (
              <button
                className="underline"
                onClick={() => onFootnote?.(Number(href.split("-").pop()))}
              >
                {children}
              </button>
            ) : href && /^https?:|^\//.test(href) ? (
              <a
                className="underline"
                href={href}
                target="_blank"
                rel="noreferrer"
              >
                {children}
              </a>
            ) : (
              <span>{children}</span>
            ),
        }}
      >
        {text
          .replace(/\{(?:st|pl)\|([^}|]+)\|([^}]+)}/g, "$2")
          .replace(/\{k\|([^}]+)}/g, "$1")
          .replace(/\{(\d+)}/g, " [сноска $1](#study-footnote-$1) ")
          .replace(/\{k\|/g, "")}
      </Markdown>
    </div>
  );
}
export default function Client() {
  const query = useSearchParams(),
    [tab, setTab] = useState(query?.get("tab") ?? "catalog"),
    [catalog, setCatalog] = useState<any>(null),
    [book, setBook] = useState<any>(null),
    [routes, setRoutes] = useState<any[]>([]),
    [state, setState] = useState<Personal>(emptyPersonal),
    [owner, setOwner] = useState("guest"),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [search, setSearch] = useState(""),
    [language, setLanguage] = useState(""),
    [category, setCategory] = useState(""),
    [workFilter, setWorkFilter] = useState(""),
    [tag, setTag] = useState(""),
    [onlyQuestions, setOnlyQuestions] = useState(false),
    [recordBook, setRecordBook] = useState(""),
    [recordCollection, setRecordCollection] = useState("");
  const [material, setMaterial] = useState<Material | null>(null),
    [selected, setSelected] = useState<Target | null>(null),
    [related, setRelated] = useState<any>(null),
    [panel, setPanel] = useState("related"),
    [stack, setStack] = useState<
      { target: Target; title: string; context?: any }[]
    >([]),
    [editing, setEditing] = useState<any>(null),
    [notebook, setNotebook] = useState<Notebook | null>(null),
    [pickCollection, setPickCollection] = useState(false),
    [linkStart, setLinkStart] = useState<Target | null>(null),
    [saved, setSaved] = useState<any[]>([]),
    [conflicts, setConflicts] = useState<any[]>([]),
    [shareDraft, setShareDraft] = useState<Notebook | null>(null),
    [shareRecords, setShareRecords] = useState<string[]>([]),
    [footnote, setFootnote] = useState<number | null>(null),
    [selectionMenu, setSelectionMenu] = useState(false),
    [bookLimit, setBookLimit] = useState(100),
    [readingContext, setReadingContext] = useState<{
      collection: Notebook;
      itemId: string;
    } | null>(null),
    [rangeStart, setRangeStart] = useState<Target | null>(null),
    [rebind, setRebind] = useState<RecordDoc | null>(null),
    [planDraft, setPlanDraft] = useState<any>(null),
    [planDate, setPlanDate] = useState(new Date().toLocaleDateString("en-CA"));
  const active = useRef("guest"),
    generation = useRef(0),
    working = useRef<Personal>(emptyPersonal()),
    queue = useRef<any[]>([]),
    syncing = useRef(false),
    selectedRef = useRef<Target | null>(null),
    didOpen = useRef(false),
    conflictsRef = useRef<any[]>([]);
  async function api(path: string, body?: any) {
    const r = await fetch("/api/v2/study/" + path, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    const d = await r.json();
    if (!r.ok)
      throw Object.assign(
        Error(d.error?.message ?? "Не удалось загрузить данные."),
        { status: r.status, remote: d.error?.remote },
      );
    return d;
  }
  function commit(s: Personal) {
    working.current = s;
    setState(s);
    void writeCache(active.current, "personal", {
      state: s,
      queue: queue.current,
      conflicts: conflictsRef.current,
    }).catch(() =>
      setError(
        "Не удалось сохранить данные на устройстве. Выгрузите свои записи.",
      ),
    );
  }
  function updateEntity(
    s: Personal,
    entity: keyof Personal,
    value: any,
    deleted = false,
  ) {
    return {
      ...s,
      [entity]: deleted
        ? s[entity].filter((v: any) => v.id !== value.id)
        : [value, ...s[entity].filter((v: any) => v.id !== value.id)],
    } as Personal;
  }
  async function boot() {
    const gen = ++generation.current;
    setReady(false);
    try {
      let who = "guest",
        remote: any = null;
      try {
        remote = await api("personal");
        who = "user:" + remote.userId;
      } catch (e) {
        if ((e as any).status !== 401 && (e as any).status !== 403)
          who = localStorage.getItem("study:owner") ?? "guest";
      }
      if (gen !== generation.current) return;
      active.current = who;
      setOwner(who);
      localStorage.setItem("study:owner", who);
      const local = await readCache<any>(who, "personal");
      if (gen !== generation.current) return;
      queue.current = local?.queue ?? [];
      const s = queue.current.length
        ? local.state
        : (remote?.state ?? local?.state ?? emptyPersonal());
      working.current = s;
      setState(s);
      conflictsRef.current = local?.conflicts ?? [];
      setConflicts(conflictsRef.current);
      const c = await publicData("catalog");
      if (gen !== generation.current) return;
      setCatalog(c);
      const rr = await publicData("routes");
      if (gen !== generation.current) return;
      setRoutes(rr.routes);
      setSaved(await savedMaterials(who));
      setReady(true);
    } catch (e) {
      setError((e as Error).message);
      setReady(true);
    }
  }
  async function publicData(path: string, body?: any, key = path) {
    const who = active.current,
      gen = generation.current;
    try {
      const d = await api(path, body);
      if (gen !== generation.current) throw Error("Вход изменился.");
      await writeCache(who, key, d);
      return d;
    } catch (e) {
      if ((e as any).status && (e as any).status < 500) throw e;
      const old = await readCache<any>(who, key);
      if (old && gen === generation.current) {
        setMessage("Открыта сохранённая копия.");
        return old;
      }
      throw e;
    }
  }
  useEffect(() => {
    void boot();
    const changed = () => {
      setMaterial(null);
      setSelected(null);
      setNotebook(null);
      setComparison(null);
      queue.current = [];
      void boot();
    };
    window.addEventListener("study-owner-changed", changed);
    return () => {
      generation.current++;
      window.removeEventListener("study-owner-changed", changed);
    };
  }, []);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);
  useEffect(() => {
    if (!ready || didOpen.current) return;
    didOpen.current = true;
    const raw = query?.get("target");
    if (raw)
      try {
        void open(JSON.parse(raw));
      } catch {
        setError("Некорректная ссылка на отрывок.");
      }
  }, [ready]);
  useEffect(() => {
    if (!material) return;
    let timer: ReturnType<typeof setTimeout>;
    const observed = material;
    const remember = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const candidates = observed.blocks
          .map((b) => ({
            b,
            rect: document
              .getElementById("study-" + b.id)
              ?.getBoundingClientRect(),
          }))
          .filter(
            (x) => x.rect && x.rect.bottom > 100 && x.rect.top < innerHeight,
          )
          .sort(
            (a, b) => Math.abs(a.rect!.top - 150) - Math.abs(b.rect!.top - 150),
          );
        const block = candidates[0]?.b;
        if (!block) return;
        const old = working.current.positions.find(
          (p) =>
            !p.collectionId &&
            targetKey(p.target) === targetKey(observed.target),
        );
        if (old?.target.blockId === block.id) return;
        void save(
          "positions",
          {
            id: old?.id ?? id(),
            target: targetAt(observed, block),
            title: observed.title,
            status: old?.status ?? "reading",
          },
          false,
          true,
        );
      }, 2000);
    };
    window.addEventListener("scroll", remember, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", remember);
    };
  }, [material, owner, readingContext?.itemId]);
  async function save(
    entity: keyof Personal,
    value: any,
    deleted = false,
    silent = false,
  ) {
    try {
      value = validateEntity(entity, value);
      const op = {
        entity,
        value,
        revision:
          value.revision ??
          working.current[entity].find((v: any) => v.id === value.id)
            ?.revision ??
          0,
        opId: crypto.randomUUID(),
        deleted,
      };
      if (active.current !== "guest")
        queue.current = queueOperation(queue.current, op);
      commit(
        updateEntity(
          working.current,
          entity,
          { ...value, revision: op.revision },
          deleted,
        ),
      );
      if (notebook && entity === "collections" && notebook.id === value.id)
        setNotebook(deleted ? null : { ...value, revision: op.revision });
      if (
        entity === "positions" &&
        !value.collectionId &&
        readingContext &&
        readingContext.collection.items.some(
          (i) =>
            i.id === readingContext.itemId &&
            i.target &&
            targetKey(i.target) === targetKey(value.target),
        )
      ) {
        await save(
          "positions",
          {
            id: "notebook-" + readingContext.collection.id,
            target: value.target,
            title: readingContext.collection.title,
            collectionId: readingContext.collection.id,
            itemId: readingContext.itemId,
            status:
              working.current.positions.find(
                (p) => p.collectionId === readingContext.collection.id,
              )?.status ?? "reading",
          },
          false,
          true,
        );
      }
      if (!silent) setMessage("Сохранено на устройстве.");
      if (active.current !== "guest") void sync();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  }
  async function sync() {
    if (active.current === "guest" || syncing.current) return;
    syncing.current = true;
    const who = active.current,
      gen = generation.current;
    try {
      while (queue.current.length) {
        const op = queue.current[0];
        let result;
        try {
          result = await api("change", { ...op, expectedUserId: who.slice(5) });
        } catch (e) {
          if ((e as any).status === 409) {
            if (gen !== generation.current) return;
            const conflict = { ...op, remote: (e as any).remote };
            conflictsRef.current = [...conflictsRef.current, conflict];
            setConflicts(conflictsRef.current);
            queue.current.shift();
            commit(working.current);
            setError(
              "Есть конфликт правок. В «Моём чтении» доступны обе версии.",
            );
            continue;
          }
          if ((e as any).status === 400 && gen === generation.current) {
            op.refused = true;
            const corrected = queue.current.some(
              (p) =>
                p.opId !== op.opId &&
                p.entity === op.entity &&
                p.value.id === op.value.id,
            );
            if (corrected)
              queue.current = queue.current.filter((p) => p.opId !== op.opId);
            commit(working.current);
            if (corrected) continue;
          }
          throw e;
        }
        if (gen !== generation.current || "user:" + result.userId !== who)
          return;
        queue.current.shift();
        let s = updateEntity(
          working.current,
          op.entity,
          result.value,
          op.deleted,
        );
        for (const pending of queue.current.filter(
          (p) => p.entity === op.entity && p.value.id === op.value.id,
        )) {
          pending.revision = result.value.revision;
          s = updateEntity(s, pending.entity, pending.value, pending.deleted);
        }
        commit(s);
      }
      setMessage("Записи синхронизированы.");
    } catch (e) {
      if (gen === generation.current)
        setError((e as Error).message + " Локальная копия сохранена.");
    } finally {
      syncing.current = false;
    }
  }
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  useEffect(
    () => showHighlights(material, state.records),
    [material, state.records],
  );
  async function compare(r: any) {
    try {
      if (r.kind !== "alignment" || r.status !== "checked")
        throw Error("Соответствие фрагментов не подтверждено.");
      const gen = generation.current;
      const pair = await Promise.all(
        [r.from, r.to].map((t) =>
          publicData("material", { target: t }, "material:" + targetKey(t)),
        ),
      );
      if (gen !== generation.current) return;
      if (![r.from, r.to].every((t, i) => t.blockId && locate(pair[i], t)))
        throw Error(
          "Источник изменился: подтверждённое соответствие пока недоступно.",
        );
      setComparison({
        materials: pair as [Material, Material],
        targets: [r.from, r.to],
        title: r.title,
        locator: r.locator,
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const opening = useRef(0);
  async function open(target: Target, remember = true) {
    setBusy(true);
    setError("");
    const gen = generation.current,
      requestId = ++opening.current;
    try {
      if (remember && material)
        setStack((s) => [
          ...s,
          {
            title: material.title,
            target: selectedRef.current ?? material.target,
            context: readingContext,
          },
        ]);
      const key = "material:" + targetKey(target);
      const m = (await publicData("material", { target }, key)) as Material;
      if (gen !== generation.current || requestId !== opening.current) return;
      setMaterial(m);
      const exact = locate(m, target),
        position = working.current.positions.find(
          (p) => !p.collectionId && targetKey(p.target) === targetKey(m.target),
        );
      const restored = exact ?? (position ? locate(m, position.target) : null);
      const focus = restored?.block ?? m.blocks[0];
      setSelected(
        focus
          ? target.kind === "bible" &&
            target.verseFrom &&
            target.verseTo &&
            target.verseTo > target.verseFrom &&
            m.blocks.find((b) => b.verse === target.verseTo)
            ? rangeTarget(
                m,
                focus.id,
                m.blocks.find((b) => b.verse === target.verseTo)!.id,
              )
            : restored && target.quote
              ? {
                  ...target,
                  ...m.target,
                  blockId: focus.id,
                  sourceHash: m.sourceHash,
                }
              : targetAt(m, focus)
          : m.target,
      );
      if ((target.blockId || target.quote || position) && !restored)
        setMessage(
          "Источник изменился или место неоднозначно. Выписка сохранена; уточните место.",
        );
      setBook(null);
      setRelated(null);
      setTimeout(
        () =>
          document
            .getElementById("study-" + focus?.id)
            ?.scrollIntoView({ block: "center" }),
        0,
      );
      void publicData(
        "related",
        { target: { ...m.target, ...target } },
        "related:" + JSON.stringify(target),
      )
        .then((d) => {
          if (gen === generation.current && requestId === opening.current)
            setRelated(d);
        })
        .catch(() => {
          if (gen === generation.current && requestId === opening.current)
            setRelated({
              notice:
                "Связи не загружены. Для чтения без сети сохраните их заранее.",
            });
        });
      return m;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function openItem(c: Notebook, item: any, resume?: Target) {
    const target =
      resume ??
      item.target ??
      working.current.records.find((r) => r.id === item.recordId)?.target;
    if (!target) {
      setError("Запись удалена или недоступна.");
      return;
    }
    setReadingContext({ collection: c, itemId: item.id });
    const m = await open(target);
    if (m) {
      const b = locate(m, target)?.block ?? m.blocks[0];
      if (b)
        await save(
          "positions",
          {
            id: "notebook-" + c.id,
            target: targetAt(m, b),
            title: c.title,
            collectionId: c.id,
            itemId: item.id,
            status:
              working.current.positions.find((p) => p.collectionId === c.id)
                ?.status ?? "reading",
          },
          false,
          true,
        );
    }
  }
  function routeNotebook(r: any): Notebook {
    return {
      id: "route-" + r.id,
      revision: r.version ?? 1,
      title: r.title,
      items: r.items.map((i: any, n: number) => ({
        ...i,
        id: i.id ?? "step-" + n,
        kind: "source",
      })),
    };
  }
  function bookNotebook(b: any): Notebook {
    return {
      id: "book-" + b.book.id,
      revision: 0,
      title: b.book.title,
      items: b.texts.map((t: any) => ({
        id: t.id,
        kind: "source",
        title: t.title,
        target: { ...t.target, edition: b.book.id },
      })),
    };
  }
  async function resumePosition(p: any) {
    if (p.collectionId?.startsWith("book-")) {
      try {
        const b = await publicData(
            "catalog?book=" + encodeURIComponent(p.collectionId.slice(5)),
          ),
          c = bookNotebook(b),
          item = c.items.find((i) => i.id === p.itemId);
        if (item) {
          await openItem(c, item, p.target);
          return;
        }
      } catch {
        setMessage(
          "Оглавление книги пока недоступно. Открыто сохранённое место.",
        );
      }
    }
    if (p.collectionId) {
      const c =
        working.current.collections.find((c) => c.id === p.collectionId) ??
        routes.map(routeNotebook).find((c) => c.id === p.collectionId);
      const item = c?.items.find((i) => i.id === p.itemId);
      if (c && item) {
        void openItem(c, item, p.target);
        return;
      }
    }
    setReadingContext(null);
    void open(p.target);
  }
  function select(b: Block) {
    if (material) setSelected(targetAt(material, b));
  }
  function selectQuote(b: Block) {
    if (!material) return;
    const selection = window.getSelection(),
      q = selection?.toString(),
      body = document.querySelector("#study-" + b.id + " [data-source-body]");
    if (q && selection?.rangeCount && body) {
      const range = selection.getRangeAt(0);
      if (
        body.contains(range.startContainer) &&
        body.contains(range.endContainer)
      ) {
        const before = range.cloneRange();
        before.selectNodeContents(body);
        before.setEnd(range.startContainer, range.startOffset);
        const prefix = before.toString(),
          plain = body.textContent ?? "";
        const positions = (s: string) => {
          const out: number[] = [];
          let at = -1;
          while ((at = s.indexOf(q, at + 1)) !== -1) out.push(at);
          return out;
        };
        const raw = positions(b.text),
          shown = positions(plain);
        const ordinal = positions(prefix).length;
        if (raw.length === shown.length && raw[ordinal] != null) {
          setSelected(targetAt(material, b, q, raw[ordinal]));
          setSelectionMenu(true);
          return;
        }
        setSelected(null);
        setError(
          "Не удалось точно определить выделение. Выберите один фрагмент без сносок или сохраните абзац целиком.",
        );
        return;
      }
    }
    select(b);
  }
  function record(kind = "note") {
    if (!selected) return;
    setSelectionMenu(false);
    setEditing({
      id: id(),
      revision: 0,
      kind,
      target: selected,
      tagsText: "",
      sourceTitle: material?.title,
      sourceBookId: material?.metadata.bookId,
      sourceBookTitle: material?.edition,
      note: "",
      tags: [],
      questionStatus: "open",
    });
  }
  async function position(status?: string) {
    if (!material || !selected) return;
    const existing = working.current.positions.find(
      (p) =>
        !p.collectionId && targetKey(p.target) === targetKey(material.target),
    );
    await save("positions", {
      id: existing?.id ?? id(),
      revision: existing?.revision ?? 0,
      target: selected,
      title: material.title,
      status: status ?? existing?.status ?? "reading",
    });
    if (status && readingContext?.collection.id.startsWith("book-"))
      await save("positions", {
        id: "notebook-" + readingContext.collection.id,
        target: selected,
        title: readingContext.collection.title,
        collectionId: readingContext.collection.id,
        itemId: readingContext.itemId,
        status,
      });
  }
  async function download(targets: Target[]) {
    setBusy(true);
    try {
      const who = active.current,
        gen = generation.current;
      const unique = Array.from(
        new Map(targets.map((t) => [targetKey(t), t])).values(),
      );
      if (!unique.length)
        throw Error("В подборке нет материалов для скачивания.");
      const missing: any[] = [],
        materials: Material[] = [];
      let bytes = 0,
        linksMissing = 0;
      for (let start = 0; start < unique.length; start += 40) {
        const chunk = await api("package", {
          targets: unique.slice(start, start + 40),
        });
        if (gen !== generation.current) return;
        missing.push(...chunk.missing);
        bytes += chunk.bytes ?? 0;
        for (const m of chunk.materials) {
          materials.push(m);
          const key = "material:" + targetKey(m.target),
            old = await readCache<Material>(who, key);
          if (!m.missing.length || !old || old.missing.length)
            await writeCache(who, key, m);
          try {
            await publicData(
              "related",
              { target: m.target },
              "related:" + JSON.stringify(m.target),
            );
          } catch {
            linksMissing++;
          }
        }
        setMessage(
          `Сохранено текстов: ${materials.length} из ${unique.length}.`,
        );
      }
      const pack = {
        complete: !missing.length && materials.length === unique.length,
        missing,
      };
      const shell = await savePage(
        "/study",
        "Библиотека для вдумчивого чтения",
      );
      if (gen !== generation.current) return;
      setSaved(await savedMaterials(who));
      setMessage(
        `${pack.complete ? "Все выбранные тексты сохранены." : "Копия неполная: " + pack.missing.map((m: any) => m.reason).join("; ")} ${shell.ok ? "Оболочка доступна без сети." : "Не удалось сохранить оболочку страницы."} ${(bytes / 1048576).toFixed(2)} МБ. ${linksMissing ? "Не загружены справки связей: " + linksMissing + "." : "Справки связей сохранены; тексты по ссылкам скачиваются отдельно."}`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function transfer() {
    const guest = await readCache<any>("guest", "personal");
    if (!guest) return;
    for (const entity of [
      "collections",
      "records",
      "links",
      "positions",
    ] as const)
      for (const v of guest.state[entity]) {
        const old = working.current[entity].find((x: any) => x.id === v.id);
        if (old) {
          setMessage("Совпадающие записи оставлены без замены.");
          continue;
        }
        await save(entity, { ...v, revision: 0 });
      }
    setMessage("Гостевые записи перенесены без замены существующих.");
  }
  async function loadBook(id: string) {
    setBusy(true);
    setBookLimit(100);
    setSearch("");
    try {
      if (material)
        setStack((v) => [
          ...v,
          {
            title: material.title,
            target: selectedRef.current ?? material.target,
            context: readingContext,
          },
        ]);
      setBook(await publicData("catalog?book=" + encodeURIComponent(id)));
      setTab("catalog");
      setMaterial(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function addItem(c: Notebook, target = selected) {
    if (!target) return;
    void save("collections", {
      ...c,
      items: [
        ...c.items,
        {
          id: id(),
          kind: "source",
          target,
          title: material?.title ?? target.id,
        },
      ],
    });
    setPickCollection(false);
  }
  function blobDownload(name: string, text: string, type: string) {
    const u = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement("a");
    a.href = u;
    a.download = name;
    a.click();
    URL.revokeObjectURL(u);
  }
  const notes = state.records.filter(
    (r) =>
      (!search ||
        normalize(
          [r.note, r.originalQuote, r.target.quote, ...r.tags].join(" "),
        ).includes(normalize(search))) &&
      (!tag || r.tags.includes(tag)) &&
      (!recordBook || (r.sourceBookId ?? r.target.id) === recordBook) &&
      (!onlyQuestions ||
        (r.kind === "question" && r.questionStatus === "open")) &&
      (!recordCollection ||
        state.collections
          .find((c) => c.id === recordCollection)
          ?.items.some(
            (i) =>
              i.recordId === r.id ||
              (i.target && targetKey(i.target) === targetKey(r.target)),
          )),
  );
  const selectedBlock = material?.blocks.find(
    (b) => b.id === selected?.blockId,
  );
  return (
    <main
      className={`${myFont.variable} ${csFontVariables} max-w-7xl mx-auto p-3 space-y-4`}
    >
      <style>
        {"::highlight(study-notes){background:#fde68a;color:inherit}"}
      </style>
      {comparison && (
        <Comparison value={comparison} onClose={() => setComparison(null)} />
      )}
      <h1 className="text-2xl font-serif">Библиотека для вдумчивого чтения</h1>
      <nav className="flex gap-2 flex-wrap" aria-label="Разделы библиотеки">
        {[
          ["catalog", "Каталог"],
          ["mine", "Моё чтение"],
          ["topics", "Изучить тему"],
        ].map(([key, title]) => (
          <button
            key={key}
            className={button + (tab === key ? " bg-amber-100 text-black" : "")}
            onClick={() => {
              setTab(key);
              setMaterial(null);
              setBook(null);
              setNotebook(null);
              setSearch("");
            }}
          >
            {title}
          </button>
        ))}
      </nav>
      <p role="status">
        {busy ? "Загружаю… " : ""}
        {message}
      </p>
      {error && (
        <p role="alert" className="border border-red-600 p-3">
          {error}
          <button className={button} onClick={() => setError("")}>
            Закрыть
          </button>
        </p>
      )}
      {!ready && <p>Загружаю библиотеку…</p>}
      {ready && (
        <>
          <div className="flex gap-3 flex-wrap">
            {owner === "guest" ? (
              <p>
                Записи сохраняются на этом устройстве.{" "}
                <Link className="underline" href="/login">
                  Войти для синхронизации
                </Link>
              </p>
            ) : (
              <>
                <button className={button} onClick={() => void sync()}>
                  Синхронизировать
                </button>
                <button className={button} onClick={() => void transfer()}>
                  Перенести гостевые записи
                </button>
              </>
            )}
            <button className={button} onClick={() => void boot()}>
              Обновить данные входа
            </button>
          </div>
          {material ? (
            <>
              {readingContext && (
                <nav
                  aria-label="Чтение подборки"
                  className="border p-3 flex gap-2 flex-wrap"
                >
                  <strong>{readingContext.collection.title}</strong>
                  {[-1, 1].map((d) => {
                    const items = readingContext.collection.items.filter(
                        (i) => i.kind === "source" || i.kind === "record",
                      ),
                      at = items.findIndex(
                        (i) => i.id === readingContext.itemId,
                      ),
                      next = items[at + d];
                    return (
                      <button
                        className={button}
                        key={d}
                        disabled={!next}
                        onClick={() =>
                          void openItem(readingContext.collection, next)
                        }
                      >
                        {d < 0 ? "Предыдущий материал" : "Следующий материал"}
                      </button>
                    );
                  })}
                </nav>
              )}
              <div className="flex flex-wrap gap-2">
                {stack.length > 0 && (
                  <button
                    className={button}
                    onClick={() => {
                      const s = stack[stack.length - 1];
                      setStack(stack.slice(0, -1));
                      setReadingContext(s.context ?? null);
                      void open(s.target, false);
                    }}
                  >
                    Назад к чтению: {stack[stack.length - 1].title}
                  </button>
                )}
                <button
                  className={button}
                  onClick={() => {
                    setMaterial(null);
                    setSelected(null);
                  }}
                >
                  Закрыть текст
                </button>
                <button
                  className={button}
                  disabled={busy}
                  onClick={() => void download([material.target])}
                >
                  Сохранить без сети
                </button>
                <button className={button} onClick={() => void position()}>
                  Запомнить место
                </button>
                <label>
                  {readingContext?.collection.id.startsWith("book-")
                    ? "Статус книги"
                    : "Статус чтения"}{" "}
                  <select
                    className={field}
                    value={
                      state.positions.find((p) =>
                        readingContext?.collection.id.startsWith("book-")
                          ? p.collectionId === readingContext.collection.id
                          : !p.collectionId &&
                            targetKey(p.target) === targetKey(material.target),
                      )?.status ?? "reading"
                    }
                    onChange={(e) => void position(e.target.value)}
                  >
                    {[
                      ["reading", "Читаю"],
                      ["deferred", "Отложено"],
                      ["read", "Прочитано"],
                    ].map(([v, t]) => (
                      <option key={v} value={v}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button
                className={button}
                onClick={() =>
                  document
                    .getElementById("study-materials")
                    ?.scrollIntoView({ block: "start" })
                }
              >
                Материалы к выбранному месту
              </button>
              <h2 className="text-xl">{material.title}</h2>
              <p>
                {material.author} · {material.edition} ·{" "}
                {bookLanguageLabel(material.language)}
              </p>
              {material.missing.length > 0 && (
                <p>Текст неполный: {material.missing.join(", ")}</p>
              )}
              <div className="grid lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)] gap-6">
                <ReadingFocus title={material.title}>
                  <article
                    className="reading-column space-y-4"
                    style={{
                      fontFamily:
                        material.language === "cu"
                          ? "var(--cs-font, var(--font-ponomar))"
                          : "var(--font-old-standard)",
                    }}
                  >
                    {material.blocks.map((b) => (
                      <section
                        key={b.id}
                        id={"study-" + b.id}
                        className={
                          "p-2 rounded " +
                          (selected?.blockId === b.id
                            ? "border-l-4 border-amber-700"
                            : "")
                        }
                        onMouseUp={() => selectQuote(b)}
                      >
                        <button
                          className="underline text-sm py-2"
                          onClick={() => select(b)}
                        >
                          {b.verse
                            ? "Стих " + b.verse
                            : "Место " + (b.index + 1)}
                        </button>
                        {state.records.some(
                          (r) => locate(material, r.target)?.block.id === b.id,
                        ) && (
                          <button
                            className={button}
                            onClick={() => {
                              select(b);
                              setPanel("notes");
                            }}
                          >
                            Мои записи к этому месту
                          </button>
                        )}
                        <div data-source-body>
                          <PlainSource text={b.text} onFootnote={setFootnote} />
                        </div>
                      </section>
                    ))}
                  </article>
                </ReadingFocus>
                <aside
                  id="study-materials"
                  className="space-y-4 lg:sticky lg:top-3 lg:self-start lg:max-h-[90vh] lg:overflow-auto"
                >
                  <button
                    className={button}
                    onClick={() =>
                      document
                        .getElementById("study-" + selected?.blockId)
                        ?.scrollIntoView({ block: "center" })
                    }
                  >
                    Назад к выбранному месту
                  </button>
                  <div className="flex flex-wrap gap-2">
                    {[
                      ["related", "К этому месту"],
                      ["toc", "Оглавление"],
                      ["notes", "Мои записи"],
                      ["edition", "Об издании"],
                    ].map(([v, t]) => (
                      <button
                        key={v}
                        className={button}
                        onClick={() => setPanel(v)}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <details open>
                    <summary>Выбранный отрывок</summary>
                    {rebind && (
                      <button
                        className={button}
                        onClick={async () => {
                          if (
                            selected &&
                            (await save("records", {
                              ...rebind,
                              originalQuote:
                                rebind.originalQuote ?? rebind.target.quote,
                              originalTarget:
                                rebind.originalTarget ?? rebind.target,
                              target: selected,
                            }))
                          ) {
                            setRebind(null);
                            setMessage(
                              "Новое место сохранено; первоначальная выписка сохранена в записи.",
                            );
                          }
                        }}
                      >
                        Привязать запись здесь
                      </button>
                    )}
                    <blockquote className="border-l pl-3 max-h-40 overflow-auto">
                      <PlainSource text={selected?.quote ?? ""} />
                    </blockquote>
                    <div className="flex gap-2 flex-wrap">
                      {[
                        ["highlight", "Выделить"],
                        ["note", "Добавить заметку"],
                        ["question", "Сохранить вопрос"],
                      ].map(([v, t]) => (
                        <button
                          className={button}
                          key={v}
                          onClick={() => record(v)}
                        >
                          {t}
                        </button>
                      ))}
                      <button
                        className={button}
                        onClick={() => setPickCollection(true)}
                      >
                        Добавить в подборку
                      </button>
                      <button
                        className={button}
                        onClick={() => {
                          setRangeStart(selected);
                          setMessage(
                            "Начало отрывка выбрано. Выберите последний абзац и завершите отрывок.",
                          );
                        }}
                      >
                        Начать с этого абзаца
                      </button>
                      {rangeStart && (
                        <button
                          className={button}
                          onClick={() => {
                            try {
                              if (
                                !material ||
                                targetKey(rangeStart) !==
                                  targetKey(material.target)
                              )
                                throw Error(
                                  "Выберите конец в том же источнике.",
                                );
                              setSelected(
                                rangeTarget(
                                  material,
                                  rangeStart.blockId!,
                                  selected!.blockId!,
                                ),
                              );
                              setRangeStart(null);
                            } catch (e) {
                              setError((e as Error).message);
                            }
                          }}
                        >
                          Закончить на этом абзаце
                        </button>
                      )}
                      <button
                        className={button}
                        onClick={() => {
                          if (linkStart && selected) {
                            void save("links", {
                              id: id(),
                              revision: 0,
                              from: linkStart,
                              to: selected,
                              note: "",
                            });
                            setLinkStart(null);
                          } else {
                            setLinkStart(selected);
                            setMessage(
                              "Откройте второй материал, выберите отрывок и завершите личную связь.",
                            );
                          }
                        }}
                      >
                        {linkStart
                          ? "Завершить личную связь"
                          : "Связать с другим материалом"}
                      </button>
                      <button
                        className={button}
                        onClick={() => {
                          if (selected)
                            void navigator.clipboard.writeText(
                              location.origin + href(selected),
                            );
                          setMessage("Ссылка скопирована.");
                        }}
                      >
                        Скопировать ссылку на место
                      </button>
                    </div>
                  </details>
                  {panel === "toc" && (
                    <ol>
                      {readingContext?.collection.id.startsWith("book-") && (
                        <>
                          <h3>Оглавление книги</h3>
                          {readingContext.collection.items.map((i) => (
                            <li key={i.id}>
                              <button
                                className={button}
                                onClick={() =>
                                  void openItem(readingContext.collection, i)
                                }
                              >
                                {i.title}
                              </button>
                            </li>
                          ))}
                        </>
                      )}
                      {!!material.metadata.bookId &&
                        !readingContext?.collection.id.startsWith("book-") && (
                          <button
                            className={button}
                            onClick={() =>
                              void loadBook(String(material.metadata.bookId))
                            }
                          >
                            Оглавление книги
                          </button>
                        )}
                      {material.blocks.map((b) => (
                        <li key={b.id}>
                          <button
                            className="underline py-2 text-left"
                            onClick={() => {
                              select(b);
                              document
                                .getElementById("study-" + b.id)
                                ?.scrollIntoView({ block: "center" });
                            }}
                          >
                            {b.verse
                              ? "Стих " + b.verse
                              : b.text.replace(/^#+\s*/, "").slice(0, 90)}
                          </button>
                        </li>
                      ))}
                    </ol>
                  )}
                  {panel === "edition" && (
                    <>
                      <h3>Об издании</h3>
                      <p>
                        {material.author} · {material.edition}
                      </p>
                      <p>Язык: {bookLanguageLabel(material.language)}</p>
                      <TextLinkList value={material.metadata.sourceUrls ?? material.source} label="Источник / скан" />
                      <TextLinkList value={material.metadata.russianUrls ?? material.metadata.russianUrl} label="Русский текст" />
                      <p>{String(material.metadata.description ?? "")}</p>
                      <p>
                        Состояние текста:{" "}
                        {String(
                          material.metadata.readiness ?? "по данным издания",
                        )}
                      </p>
                      {material.footnotes.map((f, i) => (
                        <details id={"study-footnote-" + (i + 1)} key={i}>
                          <summary>Сноска {i + 1}</summary>
                          <PlainSource text={f} />
                          <button
                            className={button}
                            onClick={() =>
                              selectedBlock &&
                              document
                                .getElementById("study-" + selectedBlock.id)
                                ?.scrollIntoView()
                            }
                          >
                            Назад к чтению
                          </button>
                        </details>
                      ))}
                    </>
                  )}
                  {panel === "notes" && (
                    <>
                      {state.records
                        .filter((r) => r.target.id === material.target.id)
                        .map((r) => (
                          <div key={r.id} className="border p-2">
                            <blockquote>
                              <PlainSource
                                text={r.originalQuote ?? r.target.quote ?? ""}
                              />
                            </blockquote>
                            <p>{r.note}</p>
                      {owner !== "guest" && <NoteSharing id={r.id}/>}
                            <button
                              className={button}
                              onClick={() =>
                                setEditing({
                                  ...r,
                                  tagsText: r.tags.join(", "),
                                })
                              }
                            >
                              Изменить
                            </button>
                            <button
                              className={button}
                              onClick={() => {
                                setRebind(r);
                                setMessage(
                                  "Откройте нужный источник, выберите отрывок и нажмите «Привязать запись здесь».",
                                );
                              }}
                            >
                              Уточнить место
                            </button>
                            <button
                              className={button}
                              onClick={() => void open(r.target)}
                            >
                              Открыть место
                            </button>
                          </div>
                        ))}
                    </>
                  )}
                  {panel === "related" && (
                    <>
                      <button
                        className={button}
                        onClick={() => {
                          if (selected)
                            void publicData(
                              "related",
                              { target: selected },
                              "related:" + JSON.stringify(selected),
                            )
                              .then(setRelated)
                              .catch((e) => setError(e.message));
                        }}
                      >
                        Связи выбранного места
                      </button>
                      {related ? (
                        <>
                          <p>{related.notice}</p>
                          {related.relationVersion !== 2 &&
                            related.relations?.length > 0 && (
                              <p>
                                Связи этой сохранённой копии нужно обновить.
                              </p>
                            )}
                          {related.relations?.map((r: any) => {
                            const t = r.other;
                            if (!t) return null;
                            return (
                              <div className="border p-2" key={r.id}>
                                <strong>
                                  {relationNames[r.kind] ?? r.kind}
                                </strong>
                                <p>{r.title}</p>
                                <p>{r.reason}</p>
                                <p>
                                  {r.author} · {r.locator}
                                </p>
                                <button
                                  className={button}
                                  onClick={() => void open(t)}
                                >
                                  Читать источник
                                </button>
                                {r.kind === "alignment" && (
                                  <button
                                    className={button}
                                    onClick={() => void compare(r)}
                                  >
                                    Сопоставить фрагменты
                                  </button>
                                )}
                              </div>
                            );
                          })}
                          {related.scripture?.length > 0 && <h3>Писание</h3>}
                          {related.scripture?.map((c: any) => (
                            <button
                              key={c.canonRef}
                              className={button}
                              onClick={() =>
                                void open({
                                  kind: "bible",
                                  id: c.canonId,
                                  chapter: c.chapter,
                                  verseFrom: c.verse,
                                  verseTo: c.verse,
                                  edition:
                                    catalog.editions[0]?.code ?? "cs-eliz",
                                })
                              }
                            >
                              {c.canonRef}
                            </button>
                          ))}
                          {related.echoes?.length > 0 && (
                            <h3>Цитируется в песнопениях</h3>
                          )}
                          {related.echoes?.map((e: any) => (
                            <div key={e.id} className="border p-2">
                              <p>
                                {e.position} · {e.memory}
                              </p>
                              <p>
                                {e.snippet.map((p: any) => p.text).join("")}
                              </p>
                              <button
                                className={button}
                                onClick={() =>
                                  void open({
                                    kind: "chant",
                                    id: String(e.id),
                                    ...(e.sourceBook
                                      ? { edition: e.sourceBook }
                                      : {}),
                                  })
                                }
                              >
                                Читать песнопение
                              </button>
                            </div>
                          ))}
                          {related.memory?.memory && (
                            <p>
                              Святой / память:{" "}
                              <Link
                                className="underline"
                                href={
                                  "/saints/" +
                                  (related.memory.memory.slug ??
                                    related.memory.memory.dneslovId)
                                }
                              >
                                {related.memory.memory.title}
                              </Link>
                            </p>
                          )}
                          {related.memory?.memory?.siblings?.map((t: any) => (
                            <button
                              className={button}
                              key={t.id}
                              onClick={() =>
                                void open({ kind: "text", id: t.id })
                              }
                            >
                              {t.name}
                            </button>
                          ))}
                          {related.places?.length > 0 && <h3>Места</h3>}
                          {related.places?.map((p: any) => (
                            <a
                              key={p.id}
                              className="underline block py-2"
                              href={p.href}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {p.name}
                            </a>
                          ))}
                          {related.memory?.mentions?.map((p: any) => (
                            <Link
                              key={p.slug ?? p.dneslovId}
                              className="underline block py-2"
                              href={"/saints/" + (p.slug ?? p.dneslovId)}
                            >
                              {p.title}
                            </Link>
                          ))}
                          {related.editions?.length > 1 && (
                            <h3>Другие редакции произведения</h3>
                          )}
                          {related.editions?.map((e: any) => (
                            <button
                              key={e.id}
                              className={button}
                              onClick={() => void loadBook(e.id)}
                            >
                              {e.title} · {e.language} · самостоятельное
                              оглавление
                            </button>
                          ))}
                        </>
                      ) : (
                        <p>Загружаю подготовленные связи…</p>
                      )}
                      <h3>Мои связи</h3>
                      {state.links
                        .filter(
                          (l) =>
                            targetKey(l.from) === targetKey(material.target) ||
                            targetKey(l.to) === targetKey(material.target),
                        )
                        .map((l) => (
                          <div key={l.id}>
                            <p>{l.note || "Личное сопоставление"}</p>
                            <button
                              className={button}
                              onClick={() => void open(l.from)}
                            >
                              Первый фрагмент
                            </button>
                            <button
                              className={button}
                              onClick={() => void open(l.to)}
                            >
                              Второй фрагмент
                            </button>
                            <button
                              className={button}
                              onClick={() =>
                                setEditing({ ...l, editorType: "link" })
                              }
                            >
                              Комментарий
                            </button>
                          </div>
                        ))}
                    </>
                  )}
                </aside>
              </div>
            </>
          ) : (
            <>
              {tab === "catalog" && (
                <>
                  {book ? (
                    <>
                      <button className={button} onClick={() => setBook(null)}>
                        Назад к каталогу
                      </button>
                      <h2>{book.book.title}</h2>
                      <p>
                        {book.book.author} · {book.book.edition} ·{" "}
                        {book.book.language}
                      </p>
                      <p>{book.book.description}</p>
                      <button
                        className={button}
                        onClick={() =>
                          void download(book.texts.map((t: any) => t.target))
                        }
                      >
                        Скачать книгу
                      </button>
                      <label>
                        Поиск в оглавлении
                        <input
                          className={field}
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </label>
                      <ol>
                        {book.texts
                          .filter(
                            (t: any) =>
                              !search ||
                              normalize(t.title).includes(normalize(search)),
                          )
                          .slice(0, bookLimit)
                          .map((t: any) => (
                            <li key={t.id}>
                              <button
                                className="underline py-2 text-left"
                                onClick={() => {
                                  const c = bookNotebook(book);
                                  void openItem(
                                    c,
                                    c.items.find((i) => i.id === t.id)!,
                                  );
                                }}
                              >
                                {t.title}
                              </button>
                            </li>
                          ))}
                      </ol>
                      {book.texts.length > bookLimit && (
                        <button
                          className={button}
                          onClick={() => setBookLimit((n) => n + 100)}
                        >
                          Показать ещё
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      {workFilter && (
                        <button
                          className={button}
                          onClick={() => setWorkFilter("")}
                        >
                          Все произведения
                        </button>
                      )}
                      <label>
                        Найти книгу или автора
                        <input
                          className={field}
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </label>
                      <div className="flex gap-3">
                        <label>
                          Язык
                          <select
                            className={field}
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                          >
                            <option value="">Все</option>
                            {Array.from(
                              new Set<string>(
                                catalog?.books
                                  ?.map((b: any) => b.language)
                                  .filter(Boolean),
                              ),
                            ).map((v) => (
                              <option key={v} value={v}>
                                {bookLanguageLabel(v)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Тематика
                          <select
                            className={field}
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                          >
                            <option value="">Все</option>
                            {Array.from(
                              new Set<string>(
                                catalog?.books
                                  ?.map((b: any) => b.category)
                                  .filter(Boolean),
                              ),
                            ).map((v) => (
                              <option key={v} value={v}>
                                {bookCategoryLabel(v)}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      {catalog?.books
                        ?.filter(
                          (b: any) =>
                            (!search ||
                              normalize(
                                [b.title, b.author, b.edition].join(" "),
                              ).includes(normalize(search))) &&
                            (!language || b.language === language) &&
                            (!category || b.category === category) &&
                            (!workFilter || b.workKey === workFilter),
                        )
                        .map((b: any) => (
                          <section className="border p-3 my-2" key={b.id}>
                            <h2>{b.title}</h2>
                            <p>
                              {b.author} · {b.edition} ·{" "}
                              {bookLanguageLabel(b.language)}
                            </p>
                            <p>
                              {b.workKey && (
                                <button
                                  className="underline"
                                  onClick={() => {
                                    setWorkFilter(b.workKey);
                                    setLanguage("");
                                    setCategory("");
                                    setSearch("");
                                  }}
                                >
                                  Все редакции произведения
                                </button>
                              )}
                            </p>
                            <p>
                              {b.available
                                ? "Текстов доступно: " + b.available
                                : b.bibleEdition
                                  ? "Издание Библии"
                                  : "Текст пока не подготовлен"}
                            </p>
                            {b.available > 0 && (
                              <button
                                className={button}
                                onClick={() => void loadBook(b.id)}
                              >
                                Оглавление
                              </button>
                            )}
                            {b.bibleEdition && (
                              <Link
                                className="underline"
                                href={"/bible?v=" + b.bibleEdition}
                              >
                                Открыть Библию
                              </Link>
                            )}
                          </section>
                        ))}
                    </>
                  )}
                </>
              )}
              {tab === "topics" && (
                <>
                  <h2>Изучить тему</h2>
                  <p>
                    Подготовленные маршруты с источниками. Личные записи в
                    редакционный оригинал не попадают.
                  </p>
                  {routes.map((r) => (
                    <section key={r.id} className="border p-3 space-y-2">
                      <h3>{r.title}</h3>
                      <p>{r.summary}</p>
                      <p>
                        {r.author} · {r.locator}
                      </p>
                      <button
                        className={button}
                        onClick={() =>
                          void save("collections", {
                            id: id(),
                            revision: 0,
                            title: r.title,
                            description: r.summary,
                            routeId: r.id,
                            items: r.items.map((i: any) => ({
                              ...i,
                              id: id(),
                              kind: "source",
                            })),
                          })
                        }
                      >
                        Скопировать в мои подборки
                      </button>
                      <button
                        className={button}
                        onClick={() =>
                          void download(r.items.map((i: any) => i.target))
                        }
                      >
                        Скачать маршрут
                      </button>
                      <ol>
                        {r.items.map((i: any, n: number) => (
                          <li key={n}>
                            <button
                              className="underline py-2 text-left"
                              onClick={() =>
                                void openItem(
                                  routeNotebook(r),
                                  routeNotebook(r).items[n],
                                )
                              }
                            >
                              {n + 1}. {i.title}
                            </button>
                            <p>{i.comment}</p>
                            <p>{i.source}</p>
                          </li>
                        ))}
                      </ol>
                    </section>
                  ))}
                  <BibleEntry
                    editions={catalog?.editions ?? []}
                    onOpen={(t) => void open(t)}
                  />
                </>
              )}
              {tab === "mine" && (
                <>
                  <h2>Моё чтение</h2>
                  <div className="flex gap-2">
                    <button
                      className={button}
                      onClick={() =>
                        blobDownload(
                          "typikon-reading.json",
                          JSON.stringify(state, null, 2),
                          "application/json",
                        )
                      }
                    >
                      Выгрузить JSON
                    </button>
                    <button
                      className={button}
                      onClick={() =>
                        blobDownload(
                          "typikon-reading.md",
                          exportMarkdown(state),
                          "text/markdown",
                        )
                      }
                    >
                      Выгрузить Markdown
                    </button>
                  </div>
                  {conflicts.map((c, i) => (
                    <section key={i} className="border border-amber-700 p-3">
                      <h3>
                        Конфликт: {c.value.title ?? c.value.note ?? "Запись"}
                      </h3>
                      <p>Моя версия: {c.value.note ?? c.value.description}</p>
                      <p>
                        Серверная версия:{" "}
                        {c.remote?.note ??
                          c.remote?.description ??
                          "Недоступна"}
                      </p>
                      <button
                        className={button}
                        onClick={() => {
                          void save(c.entity, {
                            ...c.value,
                            id: id(),
                            revision: 0,
                          });
                          conflictsRef.current = conflictsRef.current.filter(
                            (_, n) => n !== i,
                          );
                          setConflicts(conflictsRef.current);
                          commit(working.current);
                        }}
                      >
                        Сохранить мою версию отдельно
                      </button>
                      <button
                        className={button}
                        onClick={() => {
                          if (c.remote)
                            commit(
                              updateEntity(working.current, c.entity, c.remote),
                            );
                          conflictsRef.current = conflictsRef.current.filter(
                            (_, n) => n !== i,
                          );
                          setConflicts(conflictsRef.current);
                          commit(working.current);
                        }}
                      >
                        Принять серверную
                      </button>
                    </section>
                  ))}
                  <h3>Продолжить</h3>
                  {((state as any).legacyPositions ?? []).map((p: any) => (
                    <p key={p.id}>
                      <Link className="underline" href={p.href}>
                        Прежняя позиция: абзац {p.paragraph + 1} из {p.total}
                      </Link>
                    </p>
                  ))}
                  {state.positions.map((p) => (
                    <div key={p.id} className="border p-2 flex flex-wrap gap-2">
                      <button
                        className={button}
                        onClick={() => resumePosition(p)}
                      >
                        {p.title}
                      </button>
                      <span>
                        {
                          {
                            reading: "Читаю",
                            deferred: "Отложено",
                            read: "Прочитано",
                          }[p.status ?? "reading"]
                        }
                      </span>
                    </div>
                  ))}
                  <h3>Подборки</h3>
                  <button
                    className={button}
                    onClick={() =>
                      setEditing({
                        editorType: "collection",
                        id: id(),
                        revision: 0,
                        title: "",
                        description: "",
                        items: [],
                      })
                    }
                  >
                    Создать подборку
                  </button>
                  {state.collections.map((c) => (
                    <section key={c.id} className="border p-2 space-y-2">
                      <button
                        className="underline py-2"
                        onClick={() => setNotebook(c)}
                      >
                        {c.title} · {c.items.length}
                      </button>
                      <p>{c.description}</p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          className={button}
                          onClick={() =>
                            setEditing({ ...c, editorType: "collection" })
                          }
                        >
                          Изменить описание
                        </button>
                        <button
                          className={button}
                          onClick={() =>
                            void download(
                              c.items.flatMap((i) =>
                                i.target
                                  ? [i.target]
                                  : i.recordId
                                    ? state.records
                                        .filter((r) => r.id === i.recordId)
                                        .map((r) => r.target)
                                    : [],
                              ),
                            )
                          }
                        >
                          Скачать
                        </button>
                        {owner !== "guest" && (
                          <button
                            className={button}
                            onClick={() => {
                              setShareDraft(c);
                              setShareRecords([]);
                            }}
                          >
                            Поделиться копией
                          </button>
                        )}
                        {owner !== "guest" && (
                          <button
                            className={button}
                            onClick={async () => {
                              try {
                                await sync();
                                const latest = working.current.collections.find(
                                  (v) => v.id === c.id,
                                )!;
                                const preview = await api("plan", {
                                  action: "preview",
                                  id: c.id,
                                  revision: latest.revision,
                                  expectedUserId: owner.slice(5),
                                });
                                setPlanDraft({ collection: latest, preview });
                              } catch (e) {
                                setError((e as Error).message);
                              }
                            }}
                          >
                            Создать личный план
                          </button>
                        )}
                        <button
                          className={button}
                          onClick={() => void save("collections", c, true)}
                        >
                          Удалить
                        </button>
                      </div>
                    </section>
                  ))}
                  {notebook && (
                    <section className="border p-3 space-y-3">
                      <h3>{notebook.title}</h3>
                      <button
                        className={button}
                        onClick={() =>
                          setEditing({
                            editorType: "section",
                            id: id(),
                            title: "",
                            comment: "",
                          })
                        }
                      >
                        Добавить раздел
                      </button>
                      {notebook.items.map((i, n) => (
                        <div key={i.id} className="border p-2">
                          <strong>{i.title}</strong>
                          <p>{i.comment}</p>
                          {i.target && (
                            <button
                              className={button}
                              onClick={() => void openItem(notebook, i)}
                            >
                              Читать
                            </button>
                          )}
                          {i.recordId && (
                            <button
                              className={button}
                              onClick={() => {
                                const r = state.records.find(
                                  (r) => r.id === i.recordId,
                                );
                                if (r)
                                  setEditing({
                                    ...r,
                                    tagsText: r.tags.join(", "),
                                  });
                              }}
                            >
                              Открыть запись
                            </button>
                          )}
                          <button
                            className={button}
                            onClick={() =>
                              setEditing({ ...i, editorType: "item" })
                            }
                          >
                            Изменить
                          </button>
                          {[-1, 1].map((d) => (
                            <button
                              className={button}
                              key={d}
                              disabled={
                                n + d < 0 || n + d >= notebook.items.length
                              }
                              onClick={() => {
                                const items = [...notebook.items];
                                [items[n], items[n + d]] = [
                                  items[n + d],
                                  items[n],
                                ];
                                void save("collections", {
                                  ...notebook,
                                  items,
                                });
                              }}
                            >
                              {d < 0 ? "Выше" : "Ниже"}
                            </button>
                          ))}
                          <button
                            className={button}
                            onClick={() =>
                              void save("collections", {
                                ...notebook,
                                items: notebook.items.filter(
                                  (x) => x.id !== i.id,
                                ),
                              })
                            }
                          >
                            Убрать
                          </button>
                        </div>
                      ))}
                    </section>
                  )}
                  <h3>Выписки, заметки и вопросы</h3>
                  <label>
                    Поиск по цитате или записи
                    <input
                      className={field}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <label>
                      Метка
                      <select
                        className={field}
                        value={tag}
                        onChange={(e) => setTag(e.target.value)}
                      >
                        <option value="">Все</option>
                        {Array.from(
                          new Set(state.records.flatMap((r) => r.tags)),
                        ).map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Источник
                      <select
                        className={field}
                        value={recordBook}
                        onChange={(e) => setRecordBook(e.target.value)}
                      >
                        <option value="">Все</option>
                        {Array.from(
                          new Set(
                            state.records.map(
                              (r) => r.sourceBookId ?? r.target.id,
                            ),
                          ),
                        ).map((t) => (
                          <option key={t} value={t}>
                            {state.records.find(
                              (r) => (r.sourceBookId ?? r.target.id) === t,
                            )?.sourceBookTitle ??
                              state.records.find(
                                (r) => (r.sourceBookId ?? r.target.id) === t,
                              )?.sourceTitle ??
                              t}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Подборка
                      <select
                        className={field}
                        value={recordCollection}
                        onChange={(e) => setRecordCollection(e.target.value)}
                      >
                        <option value="">Все</option>
                        {state.collections.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={onlyQuestions}
                        onChange={(e) => setOnlyQuestions(e.target.checked)}
                      />
                      Открытые вопросы
                    </label>
                  </div>
                  {notes.map((r) => (
                    <section key={r.id} className="border p-3">
                      <p>
                        {r.kind === "question"
                          ? "Вопрос · " +
                            (r.questionStatus === "open"
                              ? "Открыт"
                              : "Разобран")
                          : r.kind === "highlight"
                            ? "Выделение"
                            : "Заметка"}
                      </p>
                      <blockquote>
                        <PlainSource
                          text={r.originalQuote ?? r.target.quote ?? ""}
                        />
                      </blockquote>
                      <p>{r.note}</p>
                      {owner !== "guest" && <NoteSharing id={r.id}/>}
                      <p>{r.tags.join(", ")}</p>
                      {r.unresolved && (
                        <p>
                          Старая привязка: при открытии проверьте точное место.
                        </p>
                      )}
                      <button
                        className={button}
                        onClick={() => void open(r.target)}
                      >
                        Открыть место
                      </button>
                      <button
                        className={button}
                        onClick={() =>
                          setEditing({ ...r, tagsText: r.tags.join(", ") })
                        }
                      >
                        Изменить
                      </button>
                      <button
                        className={button}
                        onClick={() => {
                          setRebind(r);
                          setMessage(
                            "Откройте нужный источник, выберите отрывок и нажмите «Привязать запись здесь».",
                          );
                        }}
                      >
                        Уточнить место
                      </button>
                      <button
                        className={button}
                        onClick={() => void save("records", r, true)}
                      >
                        Удалить
                      </button>
                      {state.collections.map((c) => (
                        <button
                          className={button}
                          key={c.id}
                          onClick={() =>
                            void save("collections", {
                              ...c,
                              items: [
                                ...c.items,
                                {
                                  id: id(),
                                  kind: "record",
                                  recordId: r.id,
                                  title:
                                    r.kind === "question" ? "Вопрос" : "Запись",
                                },
                              ],
                            })
                          }
                        >
                          В «{c.title}»
                        </button>
                      ))}
                    </section>
                  ))}
                  <h3>Загруженное</h3>
                  {saved.map((m, i) => (
                    <button
                      key={i}
                      className={button}
                      onClick={() => void open(m.target)}
                    >
                      {m.title}
                      {m.missing.length ? " · неполная копия" : ""}
                    </button>
                  ))}
                  <Link className="underline block" href="/notes">
                    Прежний список заметок
                  </Link>
                  <Link className="underline block" href="/reading-collections">
                    Прежние подборки
                  </Link>
                </>
              )}
            </>
          )}
          {selectionMenu && material && (
            <div
              role="toolbar"
              aria-label="Действия с выделением"
              className="fixed bottom-3 inset-x-3 z-40 bg-white text-black shadow-lg border p-3 flex flex-wrap gap-2"
            >
              <button className={button} onClick={() => record("highlight")}>
                Выделить
              </button>
              <button className={button} onClick={() => record("note")}>
                Добавить заметку
              </button>
              <button className={button} onClick={() => record("question")}>
                Сохранить вопрос
              </button>
              <button
                className={button}
                onClick={() => {
                  setSelectionMenu(false);
                  setPickCollection(true);
                }}
              >
                Добавить в подборку
              </button>
              <button
                className={button}
                onClick={() => {
                  setLinkStart(selected);
                  setSelectionMenu(false);
                  setMessage("Выберите второй материал для личной связи.");
                }}
              >
                Связать с другим материалом
              </button>
              <button
                className={button}
                onClick={() => setSelectionMenu(false)}
              >
                Закрыть
              </button>
            </div>
          )}
          {footnote !== null && material && (
            <section
              role="dialog"
              aria-label="Сноска"
              className="fixed inset-6 md:inset-x-1/4 z-50 overflow-auto bg-white text-black border shadow-xl p-5"
            >
              <h2>Сноска {footnote}</h2>
              <PlainSource
                text={
                  material.footnotes[
                    footnote - Number(material.metadata.footnoteBase ?? 1)
                  ] ?? "Текст сноски пока не подготовлен."
                }
              />
              <button className={button} onClick={() => setFootnote(null)}>
                Назад к чтению
              </button>
            </section>
          )}
          {editing && (
            <section
              role="dialog"
              aria-label="Редактирование записи"
              className="fixed inset-4 md:inset-x-1/4 z-50 overflow-auto bg-white text-black border shadow-xl rounded p-5 space-y-4"
            >
              <h2>
                {editing.editorType === "collection"
                  ? "Подборка"
                  : editing.editorType === "section"
                    ? "Новый раздел"
                    : editing.editorType === "link"
                      ? "Личная связь"
                      : editing.editorType === "item"
                        ? "Элемент подборки"
                        : "Моя запись"}
              </h2>
              {["collection", "section", "item"].includes(
                editing.editorType,
              ) && (
                <label>
                  Название
                  <input
                    className={field}
                    value={editing.title}
                    onChange={(e) =>
                      setEditing({ ...editing, title: e.target.value })
                    }
                  />
                </label>
              )}
              {!editing.editorType && (
                <>
                  <blockquote>
                    <PlainSource text={editing.target.quote ?? ""} />
                  </blockquote>
                  <label>
                    Вид записи
                    <select
                      className={field}
                      value={editing.kind}
                      onChange={(e) =>
                        setEditing({ ...editing, kind: e.target.value })
                      }
                    >
                      <option value="highlight">Выделение</option>
                      <option value="note">Заметка</option>
                      <option value="question">Вопрос</option>
                    </select>
                  </label>
                  <label>
                    Метки через запятую
                    <input
                      className={field}
                      value={editing.tagsText ?? editing.tags.join(", ")}
                      onChange={(e) =>
                        setEditing({ ...editing, tagsText: e.target.value })
                      }
                    />
                  </label>
                  {editing.kind === "question" && (
                    <label>
                      Состояние
                      <select
                        className={field}
                        value={editing.questionStatus}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            questionStatus: e.target.value,
                          })
                        }
                      >
                        <option value="open">Открыт</option>
                        <option value="resolved">Разобран</option>
                      </select>
                    </label>
                  )}
                </>
              )}
              <label>
                {editing.editorType === "collection"
                  ? "Описание"
                  : "Комментарий / вопрос"}
                <textarea
                  className={field}
                  rows={6}
                  value={
                    editing.description ?? editing.note ?? editing.comment ?? ""
                  }
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      [editing.editorType === "collection"
                        ? "description"
                        : ["section", "item"].includes(editing.editorType)
                          ? "comment"
                          : "note"]: e.target.value,
                    })
                  }
                />
              </label>
              <button
                className={button}
                onClick={async () => {
                  let ok;
                  if (editing.editorType === "collection")
                    ok = await save("collections", editing);
                  else if (editing.editorType === "link")
                    ok = await save("links", editing);
                  else if (
                    ["section", "item"].includes(editing.editorType) &&
                    notebook
                  ) {
                    const item = {
                      ...editing,
                      kind:
                        editing.editorType === "section"
                          ? "section"
                          : editing.kind,
                    };
                    delete item.editorType;
                    ok = await save("collections", {
                      ...notebook,
                      items:
                        editing.editorType === "section"
                          ? [...notebook.items, item]
                          : notebook.items.map((i) =>
                              i.id === item.id ? item : i,
                            ),
                    });
                  } else
                    ok = await save("records", {
                      ...editing,
                      tags: (editing.tagsText ?? editing.tags.join(", "))
                        .split(",")
                        .map((t: string) => t.trim())
                        .filter(Boolean),
                    });
                  if (ok) setEditing(null);
                }}
              >
                Сохранить
              </button>
              <button className={button} onClick={() => setEditing(null)}>
                Отмена
              </button>
            </section>
          )}
          {pickCollection && (
            <section
              role="dialog"
              aria-label="Выбрать подборку"
              className="fixed inset-8 z-50 bg-white text-black p-5 border overflow-auto"
            >
              <h2>Добавить отрывок в подборку</h2>
              {state.collections.map((c) => (
                <button
                  className={button}
                  key={c.id}
                  onClick={() => addItem(c)}
                >
                  {c.title}
                </button>
              ))}
              <button
                className={button}
                onClick={() => {
                  setPickCollection(false);
                  setEditing({
                    editorType: "collection",
                    id: id(),
                    revision: 0,
                    title: "",
                    description: "",
                    items: selected
                      ? [
                          {
                            id: id(),
                            kind: "source",
                            target: selected,
                            title: material?.title ?? selected.id,
                          },
                        ]
                      : [],
                  });
                }}
              >
                Новая подборка с этим отрывком
              </button>
              <button
                className={button}
                onClick={() => setPickCollection(false)}
              >
                Закрыть
              </button>
            </section>
          )}
          {planDraft && (
            <section
              role="dialog"
              aria-label="Подборка в личном круге"
              className="fixed inset-8 z-50 bg-white text-black border p-5 overflow-auto space-y-3"
            >
              <h2>Личный план: {planDraft.preview.title}</h2>
              <p>
                В план попадут перечисленные тексты. Личные записи останутся в
                подборке: {planDraft.preview.excludedRecords}.
              </p>
              <ol>
                {planDraft.preview.items.map((i: any, n: number) => (
                  <li key={n}>{i.title}</li>
                ))}
              </ol>
              {planDraft.preview.existingPlan ? (
                <>
                  <p>
                    Уже есть личный план «{planDraft.preview.existingPlan.title}
                    ». Он сохранён.
                  </p>
                  <Link className="underline" href="/reading-plan">
                    Открыть действующий план
                  </Link>
                </>
              ) : (
                <>
                  <label>
                    Дата начала
                    <input
                      type="date"
                      className={field}
                      value={planDate}
                      onChange={(e) => setPlanDate(e.target.value)}
                    />
                  </label>
                  <button
                    className={button}
                    onClick={async () => {
                      try {
                        await api("plan", {
                          action: "create",
                          id: planDraft.collection.id,
                          revision: planDraft.collection.revision,
                          date: planDate,
                          expectedUserId: owner.slice(5),
                        });
                        setPlanDraft(null);
                        setMessage(
                          "Личный план создан. В «Моём круге» добавьте блок «Личный план», чтобы подключить его к правилу.",
                        );
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    Создать план из этих текстов
                  </button>
                </>
              )}
              <Link className="underline block" href="/prayer-circle">
                Открыть «Мой круг»
              </Link>
              <button className={button} onClick={() => setPlanDraft(null)}>
                Закрыть
              </button>
            </section>
          )}
          {shareDraft && (
            <section
              role="dialog"
              aria-label="Состав опубликованной копии"
              className="fixed inset-8 z-50 bg-white text-black p-5 border overflow-auto space-y-3"
            >
              <h2>Опубликовать копию «{shareDraft.title}»</h2>
              <p>
                Будут доступны название, описание, источники и комментарии
                элементов. Личные записи включаются только отмеченные ниже.
              </p>
              {shareDraft.items
                .filter((i) => i.kind === "record")
                .map((i) => {
                  const r = state.records.find((r) => r.id === i.recordId);
                  return (
                    <label className="block" key={i.id}>
                      <input
                        type="checkbox"
                        checked={shareRecords.includes(i.recordId!)}
                        onChange={(e) =>
                          setShareRecords((v) =>
                            e.target.checked
                              ? [...v, i.recordId!]
                              : v.filter((id) => id !== i.recordId),
                          )
                        }
                      />
                      {r?.note || r?.target.quote}
                    </label>
                  );
                })}
              <button
                className={button}
                onClick={async () => {
                  try {
                    await sync();
                    const latest = working.current.collections.find(
                      (c) => c.id === shareDraft.id,
                    )!;
                    const result = await api("publish", {
                      action: "publish",
                      id: latest.id,
                      revision: latest.revision,
                      recordIds: shareRecords,
                      expectedUserId: owner.slice(5),
                    });
                    setMessage(
                      "Опубликованная копия: " + location.origin + result.href,
                    );
                    setShareDraft(null);
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Опубликовать выбранный состав
              </button>
              <button
                className={button}
                onClick={async () => {
                  try {
                    await api("publish", {
                      action: "unpublish",
                      id: shareDraft.id,
                      revision: shareDraft.revision,
                      expectedUserId: owner.slice(5),
                    });
                    setShareDraft(null);
                    setMessage("Опубликованные копии закрыты.");
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Закрыть все опубликованные копии
              </button>
              <button className={button} onClick={() => setShareDraft(null)}>
                Отмена
              </button>
            </section>
          )}
        </>
      )}
    </main>
  );
}
function BibleEntry({
  editions,
  onOpen,
}: {
  editions: any[];
  onOpen: (t: Target) => void;
}) {
  const [edition, setEdition] = useState("cs-eliz"),
    [book, setBook] = useState("matfeya"),
    [chapter, setChapter] = useState(6),
    [from, setFrom] = useState(1),
    [to, setTo] = useState(18);
  return (
    <section className="border p-3 space-y-2">
      <h3>Открыть место Писания</h3>
      <label>
        Издание
        <select
          className={field}
          value={edition}
          onChange={(e) => setEdition(e.target.value)}
        >
          {editions.map((e) => (
            <option key={e.code} value={e.code}>
              {e.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        Книга
        <select
          className={field}
          value={book}
          onChange={(e) => setBook(e.target.value)}
        >
          {BIBLE_CANON.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Глава
        <input
          className={field}
          type="number"
          min="1"
          value={chapter}
          onChange={(e) => setChapter(Number(e.target.value))}
        />
      </label>
      <label>
        Стихи от
        <input
          className={field}
          type="number"
          min="1"
          value={from}
          onChange={(e) => setFrom(Number(e.target.value))}
        />
      </label>
      <label>
        до
        <input
          className={field}
          type="number"
          min={from}
          value={to}
          onChange={(e) => setTo(Number(e.target.value))}
        />
      </label>
      <button
        className={button}
        onClick={() =>
          onOpen({
            kind: "bible",
            id: book,
            edition,
            chapter,
            verseFrom: from,
            verseTo: to,
          })
        }
      >
        Читать и изучать
      </button>
    </section>
  );
}

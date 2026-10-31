// Только чтение typikon. JSON содержит публичные метаданные, без тел текстов и пользователей.
// npx tsx src/scripts/audit-release-6-4.ts > /tmp/release-6-4.json
import "@/scripts/lib/env";
import { createHash } from "node:crypto";
import { MongoClient } from "mongodb";
import { TextType } from "@/utils/texts";
import { getWeekAndDay } from "@/utils/movableCycle";
import { resolvePericopeVersesWithFallback } from "@/lib/pericopes";
import { DEFAULT_BIBLE_LANGUAGE } from "@/utils/bibleLanguage";
import { continuousReading } from "@/lib/continuousReading";

const client = new MongoClient(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 5000 });
const key = (id: unknown) => String(id ?? "");
const present = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const fields = Object.values(TextType);

async function main() {
    await client.connect();
    const db = client.db("typikon");
    const [weeks, days, books, texts, pericopes, editions] = await Promise.all([
        db.collection("weeks").find({}).toArray(),
        db.collection("days").find({}).toArray(),
        db.collection("books").find({}, { projection: { name: 1, alias: 1, texts: 1, public: 1 } }).toArray(),
        db.collection("texts").find({}, { projection: {
            name: 1, alias: 1, bookId: 1, readiness: 1, content: 1, bookIndex: 1, start: 1, startPhrase: 1,
        } }).toArray(),
        db.collection("pericopes").find({}).toArray(),
        db.collection("bible_editions").find({}, { projection: { bookId: 1, code: 1 } }).toArray(),
    ]);
    const textMap = new Map(texts.map(t => [key(t._id), t]));
    const bookMap = new Map(books.map(b => [key(b._id), b]));
    const dayMap = new Map(days.map(d => [key(d._id), d]));
    const pericopeMap = new Map(pericopes.map(p => [key(p._id), p]));
    const pericopeCoverage = new Map<string, boolean>();
    const aliases = (docs: typeof texts) => {
        const groups = new Map<string, string[]>();
        for (const doc of docs) if (present(doc.alias)) {
            groups.set(doc.alias, [...(groups.get(doc.alias) ?? []), key(doc._id)]);
        }
        return {
            total: docs.length,
            missing: docs.filter(d => !present(d.alias)).map(d => ({
                id: key(d._id), name: d.name, bookId: key(d.bookId), readiness: d.readiness,
                hasContent: present(d.content),
            })),
            duplicates: [...groups].filter(([, ids]) => ids.length > 1).map(([alias, ids]) => ({ alias, ids })),
            objectIdShaped: docs.filter(d => present(d.alias) && /^[a-f\d]{24}$/i.test(d.alias))
                .map(d => ({ id: key(d._id), alias: d.alias })),
        };
    };

    const periods = [];
    for (const [period, flag, start, end] of [
        ["penticostarion", "penticostration", 0, 56],
        ["triodion", "triodion", -70, -1],
    ] as const) {
        const selectedWeeks = weeks.filter(w => w[flag] === true);
        const ids = new Set(selectedWeeks.flatMap(w => (w.days ?? []).map(key)));
        // Проверяем оба способа принадлежности: указатель weeks.days и калькулятор days.weekId.
        const weekIds = new Set(selectedWeeks.map(w => key(w._id)));
        const selectedDays = days.filter(d => ids.has(key(d._id)) || weekIds.has(key(d.weekId)));
        const structure: unknown[] = [];
        for (const w of selectedWeeks) {
            for (const id of w.days ?? []) {
                const d = dayMap.get(key(id));
                if (!d || key(d.weekId) !== key(w._id)) structure.push({
                    kind: "week-day-link", week: w.alias, dayId: key(id), actualWeekId: key(d?.weekId),
                });
            }
            for (const d of selectedDays.filter(d => key(d.weekId) === key(w._id))) {
                if (!(w.days ?? []).some((id: unknown) => key(id) === key(d._id))) structure.push({
                    kind: "day-not-listed", week: w.alias, day: d.alias, dayId: key(d._id),
                });
            }
        }
        // Сетка ожидаемых дат — по действующему калькулятору, а не предположению «7 дней у каждой недели».
        const dateCoverage = [];
        const reached = new Set<string>();
        for (let offset = start; offset <= end; offset++) {
            const easter = new Date("2026-04-12T00:00:00Z");
            const date = new Date(+easter + offset * 86400000);
            const search = getWeekAndDay(date, easter, new Date("2025-04-20T00:00:00Z"));
            const candidates = selectedDays.filter(d => d.weekIndex === search.day && selectedWeeks.some(w =>
                key(d.weekId) === key(w._id) && w.type === search.type && w.value === search.week));
            candidates.forEach(d => reached.add(key(d._id)));
            if (candidates.length !== 1) dateCoverage.push({
                offset, date: date.toISOString().slice(0, 10), search,
                matches: candidates.map(d => ({ id: key(d._id), alias: d.alias, name: d.name })),
            });
        }
        const rows = [];
        for (const w of selectedWeeks.sort((a, b) => key(a.type).localeCompare(key(b.type)) || a.value - b.value)) {
            for (const d of selectedDays.filter(d => key(d.weekId) === key(w._id)).sort((a, b) => a.weekIndex - b.weekIndex)) {
                const entries = [];
                const emptySlots = [];
                for (const slot of fields) {
                    const items = d[slot]?.items ?? [];
                    if (!items.length) emptySlots.push(slot);
                    for (const [index, item] of items.entries()) {
                        const t = textMap.get(key(item.textId));
                        let status: string;
                        if (item.continuousReading) {
                            status = continuousReading(item.continuousReading) ? "continuous-reading" : "invalid-continuous-reading";
                        } else if (item.pericopeId) {
                            const p = pericopeMap.get(key(item.pericopeId));
                            if (p && !pericopeCoverage.has(key(p._id))) {
                                pericopeCoverage.set(key(p._id), Boolean(await resolvePericopeVersesWithFallback(db, p, DEFAULT_BIBLE_LANGUAGE)));
                            }
                            status = !p ? "missing-pericope" : pericopeCoverage.get(key(p._id)) ? "pericope-resolved" : "pericope-unresolved";
                        } else if (item.textId) {
                            status = !t ? "missing-text" : !present(t.content) ? "empty-text" : "text-present";
                            if (t && present(t.content) && item.statia) {
                                const parts = /\[Среда:]/.test(t.content) ? t.content.split(/\[Среда:]/) : t.content.split(/\[Статия \d+]/);
                                // Точно повторяем getContent: parts[statia - 1], без предположений о нумерации источника.
                                if (!present(parts[(item.statia - 1) || 0])) status = "empty-selected-statia";
                            }
                        } else status = item.paschal === false ? "calendar-reference" : "unassigned";
                        entries.push({ slot, index, status,
                            continuousReading: continuousReading(item.continuousReading) ?? undefined,
                            textId: key(item.textId) || undefined,
                            pericopeId: key(item.pericopeId) || undefined, name: t?.name,
                            bookIndex: t?.bookIndex, start: t?.start, startPhrase: t?.startPhrase,
                            contentSha256: present(t?.content)
                                ? createHash("sha256").update(t.content).digest("hex") : undefined,
                            pericope: item.pericopeId ? (() => {
                                const p = pericopeMap.get(key(item.pericopeId));
                                return p ? { label: p.label, source: p.source, number: p.number,
                                    bookSlug: p.bookSlug, variant: p.variant, ranges: p.ranges,
                                    ...(p.liturgicalEnding ? { liturgicalEnding: p.liturgicalEnding } : {}),
                                    ...(p.liturgicalSourceUrl ? { liturgicalSourceUrl: p.liturgicalSourceUrl } : {}),
                                    ...(p.liturgicalText ? { liturgicalText: p.liturgicalText } : {}),
                                } : null;
                            })() : undefined,
                            book: bookMap.get(key(t?.bookId))?.name, readiness: t?.readiness,
                            alias: t?.alias, cite: item.cite || undefined, description: item.description || undefined,
                            statia: item.statia,
                        });
                    }
                }
                rows.push({ id: key(d._id), alias: d.alias, name: d.name, week: w.alias,
                    type: w.type, value: w.value, weekIndex: d.weekIndex, emptySlots, entries });
            }
        }
        const statuses: Record<string, number> = {};
        for (const row of rows) for (const e of row.entries) statuses[e.status] = (statuses[e.status] ?? 0) + 1;
        periods.push({ period, weeks: selectedWeeks.length, days: selectedDays.length, structure, dateCoverage,
            unreachedDays: selectedDays.filter(d => !reached.has(key(d._id)))
                .map(d => ({ id: key(d._id), alias: d.alias, name: d.name })),
            statuses, rows });
    }
    const publicBooks = books.filter(b => b.public !== false);
    const publicIds = new Set(publicBooks.map(b => key(b._id)));
    const publicTexts = texts.filter(t => publicIds.has(key(t.bookId)));
    const report = {
        generatedAt: new Date().toISOString(), gitRevision: process.env.AUDIT_GIT_REVISION ?? null,
        counts: { weeks: weeks.length, days: days.length, books: books.length, texts: texts.length },
        periods,
        aliases: { books: aliases(publicBooks), texts: aliases(texts), publicBookTexts: aliases(publicTexts),
            days: aliases(days), weeks: aliases(weeks) },
        books: publicBooks.map(b => ({ id: key(b._id), name: b.name, alias: b.alias ?? null,
            bibleCode: editions.find(e => key(e.bookId) === key(b._id))?.code ?? null,
            texts: (b.texts ?? []).length,
            brokenTextIds: (b.texts ?? []).filter((id: unknown) => !textMap.has(key(id))).map(key),
        })),
        aliasIndexes: Object.fromEntries(await Promise.all(["books", "texts", "days", "weeks"].map(async name =>
            [name, (await db.collection(name).indexes()).filter(i => i.key.alias)]))),
    };
    console.log(JSON.stringify(report, null, 2));
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; })
    .finally(() => client.close());

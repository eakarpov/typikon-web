// Read-only: validate the 33 remaining placements against the local corpus.
// tsx src/scripts/validate-pentecostarion-local.ts /tmp/pentecostarion-validation
// Private scratch output contains public source bodies and rendered HTML.
import "@/scripts/lib/env";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { ObjectId } from "mongodb";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import DayPartReading from "@/app/components/DayPartReading";
import { daySlots } from "@/lib/api/v2/serialize";
import { TextType, valueTitle } from "@/utils/texts";

async function main() {
    if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.MONGODB_URI!).hostname)) {
        throw new Error("This validation is restricted to local MongoDB");
    }
    const { default: clientPromise } = await import("@/lib/mongodb");
    const { getTriodicItem } = await import("@/pages/api/calc/getTriodion");
    const client = await clientPromise;
    try {
        const dir = process.argv[2];
        if (!dir) throw new Error("Supply scratch output directory");
        mkdirSync(dir, { recursive: true });
        const previous = "docs/audits/pentecostarion-local-validation.json";
        const review = JSON.parse(readFileSync("docs/audits/pentecostarion-typikon-review.json", "utf8"));
        const targets = existsSync(previous)
            ? JSON.parse(readFileSync(previous, "utf8")).placements
            : review.days.flatMap((d: any) => d.entries.filter((e: any) =>
                e.sourceReview === "thematic-reading;exact-identification-open")
                .map((e: any) => ({ ...e, dayId: d.id, offset: d.offset, day: d.name })));
        if (targets.length !== 33) throw new Error(`Expected 33 targets, got ${targets.length}`);
        const db = client.db("typikon");
        const days = new Map<string, any>();
        const placements = [];
        for (const t of targets) {
            if (!days.has(t.dayId)) {
                const raw = await db.collection("days").findOne({ _id: new ObjectId(t.dayId) });
                if (!raw) throw new Error(`Missing day ${t.dayId}`);
                const week = await db.collection("weeks").findOne({ _id: raw.weekId });
                if (!week) throw new Error(`Missing week ${t.dayId}`);
                days.set(t.dayId, await getTriodicItem({ type: week.type, week: week.value, day: raw.weekIndex }));
            }
            const day = days.get(t.dayId);
            const item = day?.[t.slot]?.items[t.index];
            if (String(item?.text?._id) !== t.textId) throw new Error(`Changed placement ${t.dayId}/${t.slot}/${t.index}`);
            const text = item.text;
            const content = text.content as string;
            const marker = content.includes("[Среда:]") ? /\[Среда:\]/g : /\[Статия \d+\]/g;
            const parts = content.split(marker);
            const selected = parts[(item.statia ?? 1) - 1];
            const api = daySlots({ [t.slot]: { ...day[t.slot], items: [item] } }, [t.slot],
                s => valueTitle(s as TextType), true)[0].items[0] as any;
            const checks = {
                ready: text.readiness === "ready",
                selectedPartNonempty: Boolean(selected?.trim()),
                aggregationContent: typeof content === "string" && content.trim().length > 0,
                apiTextAndSelector: api.text?.id === t.textId && api.text?.content === content
                    && (api.statia ?? 1) === (item.statia ?? 1),
            };
            const n = placements.length;
            writeFileSync(`${dir}/${n}.html`, renderToStaticMarkup(React.createElement(DayPartReading, {
                valueName: t.slot as TextType, value: { ...day[t.slot], items: [item] }, paschal: true,
            })));
            placements.push({
                dayId: t.dayId, offset: t.offset, day: t.day, slot: t.slot, index: t.index,
                textId: t.textId, name: text.name, book: text.book?.name, bookIndex: text.bookIndex,
                statia: item.statia ?? null, readiness: text.readiness,
                sha256: createHash("sha256").update(content).digest("hex"),
                contentLength: content.length, partCount: parts.length,
                selectedLength: selected?.trim().length ?? 0, start: selected?.trim().slice(0, 200),
                end: selected?.trim().slice(-160), cite: item.cite ?? null, description: item.description ?? null,
                checks, selected, content, footnotes: text.footnotes ?? [],
            });
        }
        writeFileSync(`${dir}/raw.json`, JSON.stringify({ validatedAt: new Date().toISOString(), placements }, null, 2));
        console.log(JSON.stringify({ placements: placements.length, texts: new Set(placements.map(p => p.textId)).size,
            days: days.size, failed: placements.filter(p => Object.values(p.checks).some(v => !v))
                .map(p => ({ textId: p.textId, checks: p.checks })) }));
    } finally {
        await client.close();
    }
}
main().catch(e => { console.error(e); process.exitCode = 1; });

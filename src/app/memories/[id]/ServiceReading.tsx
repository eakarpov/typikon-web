import Link from "next/link";
import { rulesDb } from "@/lib/rulesDb";
import { saintService } from "@/lib/saintWorks";
import { needsChurchFont, bookLanguageLabel } from "@/utils/bookLanguages";
import { schemaLanguage } from "@/lib/seo/metadata";
import { UNIT_LABELS, SERVICE_LABELS } from "@/utils/chantLabels";

export default function ServiceReading({ id, language }: { id: string; language?: string }) {
    const db = rulesDb();
    if (!db) return null;
    const service = saintService(db, id, language || null);
    if (!service || (!service.rows.length && !service.canons.length)) return null;
    const groups = new Map<string, typeof service.rows>();
    for (const row of service.rows) {
        const key = `${row.groupId}:${row.language}`;
        groups.set(key, [...(groups.get(key) || []), row]);
    }
    return <section id="service" className="reading-column mt-6 space-y-4">
        <h2 className="font-serif font-bold text-xl">Служба: {service.title}</h2>
        {[...groups.entries()].map(([key, rows]) => <section key={key} className="space-y-2">
            <h3 className="font-serif font-bold">{[SERVICE_LABELS[rows[0].service] || rows[0].service, rows[0].label, bookLanguageLabel(rows[0].language), rows[0].tone ? `Глас ${rows[0].tone}` : null].filter(Boolean).join(" · ")}</h3>
            {rows.map((row: any) => <div key={row.item_id}>
                <p className="font-serif text-sm text-red-800">{UNIT_LABELS[row.unit] || row.unit}{row.rubric ? ` · ${row.rubric}` : ""}</p>
                {row.missing ? <p className="font-serif text-slate-500">Текст пока не отекстован.</p> : <p lang={schemaLanguage(row.language)} className={`reading-text whitespace-pre-wrap ${needsChurchFont(row.language) ? "font-sans-serif" : "font-serif"}`}>{row.text.replace(/\s*\/\s*/g, "\n")}</p>}
            </div>)}
        </section>)}
        {!!service.canons.length && <div><h3 className="font-serif font-bold">Каноны службы</h3><ul className="list-disc pl-5">{service.canons.map((canon: any) => <li key={canon.id}><Link className="text-amber-800 underline" href={`/canons/${encodeURIComponent(canon.id)}`}>{bookLanguageLabel(canon.language)}{canon.tone ? ` · Глас ${canon.tone}` : ""}</Link></li>)}</ul></div>}
    </section>;
}

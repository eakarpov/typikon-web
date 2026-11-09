import Link from "next/link";
import type { SaintWork } from "@/lib/saintWorks";
import { needsChurchFont, bookLanguageShort } from "@/utils/bookLanguages";
import { saintWorkHref, SAINT_WORK_LABELS } from "@/lib/saintWorkLinks";

export default function Works({ items }: { items: SaintWork[] }) {
    if (!items.length) return null;
    return <section className="my-5 space-y-3" aria-label="Службы и песнопения святого">
        <h2 className="font-serif font-bold text-lg">Службы и песнопения</h2>
        {items.map(work => <article key={`${work.reader}:${work.id}:${work.language}`} className="border-l-2 border-amber-800 pl-3">
            <Link className="font-serif text-amber-800 underline" href={saintWorkHref(work)}>
                {SAINT_WORK_LABELS[work.genre] || work.genre}{work.reader === "service" || work.reader === "canon" ? `: ${work.title}` : ""}
            </Link>
            <p className="font-serif text-sm text-slate-500">{[work.subtitle, bookLanguageShort(work.language)].filter(Boolean).join(" · ")}</p>
            {work.text && <p className={`reading-text whitespace-pre-wrap mt-1 ${needsChurchFont(work.language) ? "font-sans-serif" : "font-serif"}`}>{work.text.replace(/\s*\/\s*/g, "\n")}</p>}
        </article>)}
    </section>;
}

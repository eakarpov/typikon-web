import Link from "next/link";
import { RELIC_KINDS, sourceHref, SOURCE_TYPES, type Relic } from "@/lib/pilgrimage/relics";
import { humanDate } from "@/app/pomyannik/labels";

// Строка святыни — одна на «что рядом», карточку храма, досье и поездку, чтобы
// источник везде показывался одинаково и нигде не терялся.

const RelicLine = ({ relic, showSaint = true, showSite = true, distance }: {
    relic: Relic; showSaint?: boolean; showSite?: boolean; distance?: string;
}) => {
    const href = sourceHref(relic.source);
    const sourceLabel = relic.source.type === "book" || relic.source.type === "parish"
        ? relic.source.ref
        : SOURCE_TYPES[relic.source.type];
    return (
        <li className="font-serif mb-2">
            <span className="text-slate-700">{RELIC_KINDS[relic.kind]}</span>
            {showSaint && (
                <>
                    {" "}
                    {relic.saintSlug
                        ? <Link className="text-amber-800 hover:underline" href={`/saints/${relic.saintSlug}`}>{relic.saintName}</Link>
                        : relic.saintName}
                </>
            )}
            {showSite && (
                <>
                    {" — "}
                    {relic.templeSlug
                        ? <Link className="text-amber-800 hover:underline" href={`/temples/${relic.templeSlug}`}>{relic.siteName}</Link>
                        : relic.siteName}
                </>
            )}
            {relic.where && <span className="text-slate-600">, {relic.where}</span>}
            {distance && <span className="text-slate-500 text-sm"> · {distance}</span>}
            {relic.state === "visiting" && relic.visit && (
                <div className="text-sm text-red-800">
                    Принесены на время: с {humanDate(relic.visit.from)} по {humanDate(relic.visit.to)}
                </div>
            )}
            {relic.state === "former" && <div className="text-sm text-slate-500">Пребывали здесь прежде</div>}
            <div className="text-xs text-slate-500">
                Источник:{" "}
                {href ? <a className="text-amber-800 hover:underline" href={href} target="_blank" rel="noreferrer">{sourceLabel}</a> : sourceLabel}
                {relic.source.date && `, ${humanDate(relic.source.date)}`}
                {relic.source.note && ` (${relic.source.note})`}
            </div>
        </li>
    );
};

export default RelicLine;

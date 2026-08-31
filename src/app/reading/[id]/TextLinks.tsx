import { Suspense } from "react";
import Link from "next/link";
import { CalendarIcon, UserCircleIcon } from "@heroicons/react/24/outline";
import { getDayByText, getTextLinks, getTextSource } from "@/app/reading/[id]/api";
import { sourceLabel } from "@/lib/libFond";
import { DayDTO } from "@/types/dto/days";

// Связи текста — под самим чтением, а не в шапке: это то, куда идут, дочитав,
// а не то, чем перебивают чтение. В шапке связь была одна ("Страница святого"),
// и обратной стороны — "а где ещё об этом" — у читателя не было вовсе.

// Раздел, в котором живёт день: неподвижный круг, цветная или постная триодь.
const dayHref = (day: DayDTO | any) => {
    const slug = day.alias || day.id;
    if (day.monthIndex) return `/calendar/${slug}`;
    if (day.week?.penticostration) return `/penticostarion/${slug}`;
    if (day.week?.triodion) return `/triodion/${slug}`;
    return null;
};

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex flex-row flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-serif text-slate-500 shrink-0">{label}</span>
        {children}
    </div>
);

const TextLinksContent = async ({ item }: { item: any }) => {
    const [links, [day], source] = await Promise.all([
        getTextLinks(item),
        getDayByText(item.id),
        getTextSource(item.link || null),
    ]);

    const href = day ? dayHref(day) : null;
    const origin = sourceLabel(source);

    if (!links.memory && !links.mentions.length && !href && !origin) return null;

    return (
        <div className="mt-6 pt-3 border-t border-slate-300 flex flex-col gap-2 no-pdf">
            <p className="font-serif font-bold">Связи</p>

            {links.memory && (
                <Row label="Память:">
                    <Link className="font-serif text-amber-800 hover:underline" href={`/saints/${links.memory.slug ?? links.memory.dneslovId}`}>
                        {links.memory.title}
                    </Link>
                    <UserCircleIcon className="w-4 h-4 text-amber-800" />
                </Row>
            )}

            {!!links.memory?.siblings.length && (
                <Row label={`Ещё к этой памяти (${links.memory.total}):`}>
                    <span className="flex flex-col">
                        {links.memory.siblings.map((sibling) => (
                            <Link
                                key={sibling.id}
                                className="font-serif text-amber-800 hover:underline"
                                href={`/reading/${sibling.id}`}
                            >
                                {sibling.name}
                            </Link>
                        ))}
                        {links.memory.total > links.memory.siblings.length && (
                            <Link className="font-serif text-sm text-slate-500 hover:underline" href={`/saints/${links.memory.slug ?? links.memory.dneslovId}`}>
                                и ещё {links.memory.total - links.memory.siblings.length} — все на странице памяти
                            </Link>
                        )}
                    </span>
                </Row>
            )}

            {!!links.mentions.length && (
                <Row label="Упоминаются:">
                    {links.mentions.map((mention) => (
                        <Link
                            key={mention.dneslovId}
                            className="font-serif text-amber-800 border rounded border-slate-300 px-2 py-0.5 text-sm hover:underline"
                            href={`/saints/${mention.slug ?? mention.dneslovId}`}
                        >
                            {mention.title}
                        </Link>
                    ))}
                </Row>
            )}

            {origin && source && (
                // Откуда набран текст — рукопись или старопечатная книга в
                // описи РГБ. Стоит здесь, а не в шапке, по той же причине, что
                // и прочие связи: это то, куда идут, дочитав, а не то, чем
                // перебивают чтение. Ссылка ведёт в опись, а не на лист: лист
                // у каждого текста свой и уже стоит наверху («Скан текста»).
                <Row label="Источник:">
                    <a
                        className="font-serif text-amber-800 hover:underline"
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                    >
                        {origin}
                    </a>
                </Row>
            )}

            {href && (
                <Row label="Читается в день:">
                    <Link className="font-serif text-amber-800 hover:underline" href={href}>
                        {day.name || day.alias || "Календарь"}
                    </Link>
                    <CalendarIcon className="w-4 h-4 text-amber-800" />
                </Row>
            )}
        </div>
    );
};

// Имена святых приезжают со стороны (dneslov.org, кэш на сутки) — держать из-за них
// текст в ожидании незачем: блок дорисуется отдельно.
const TextLinks = ({ item }: { item: any }) => (
    <Suspense fallback={null}>
        {/* @ts-expect-error Async Server Component */}
        <TextLinksContent item={item} />
    </Suspense>
);

export default TextLinks;

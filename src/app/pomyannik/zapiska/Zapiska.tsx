'use client';
import React from "react";
import Link from "next/link";
import type { PomyannikPerson, NoteKind } from "@/lib/pomyannik/types";
import { MAX_NAMES_IN_NOTE, NOTE_KINDS, NOTE_KIND_BY_KEY } from "@/lib/pomyannik/types";
import { displayName, rankChurchGenitive, rankGenitive } from "@/app/pomyannik/labels";
import type { SlavonicName } from "@/lib/pomyannik/slavonic";

// СБОРКА ЗАПИСКИ.
//
// Тип поминовения выбирается ПЕРВЫМ, и он же решает, кого можно вписать:
// панихида о живых не служится, молебен об усопших — тоже. Показывать все имена
// подряд и ловить ошибку потом значило бы переложить на человека работу, которую
// у свечного ящика делает свечница.
//
// ПРЕДПРОСМОТР ЦЕРКОВНОСЛАВЯНСКИЙ И В РОДИТЕЛЬНОМ ПАДЕЖЕ — так записку и
// читают. Где склонение наше, а где мы только переписали имя другим письмом,
// сказано под предпросмотром: наш именительный, принятый за проверенный
// родительный, — худшее, что тут может выйти.

const BUTTON = "border rounded px-3 py-1 bg-slate-50 hover:bg-slate-100 font-serif text-sm";

const TITLE: Record<"living" | "departed", string> = {
    living: "о здравии",
    departed: "о упокоении",
};

/**
 * Кому подаём. Пусто — записка только для печати.
 *
 * Сборка у печатной и у отправляемой записки одна и та же, и разводить её по
 * двум почти одинаковым страницам значило бы завести две правды о том, кого в
 * какое поминовение можно вписать.
 */
export interface Recipient {
    title: string;
    place?: string | null;
    /** Чем открыт приём: кодом-приглашением или открытой страницей. */
    code?: string;
    slug?: string;
    /** Что он принимает. Пусто — принимает всё. */
    accepts: NoteKind[];
}

const Zapiska = ({ persons, slavonic, to }: {
    persons: PomyannikPerson[];
    slavonic: Record<string, SlavonicName>;
    to?: Recipient;
}) => {
    const offered = React.useMemo(
        () => to?.accepts.length ? NOTE_KINDS.filter(k => to.accepts.includes(k.key)) : NOTE_KINDS,
        [to],
    );
    const [kind, setKind] = React.useState<NoteKind>(offered[0]?.key ?? "proskomidia");
    const [picked, setPicked] = React.useState<Set<string>>(new Set());
    const [sending, setSending] = React.useState(false);
    const [sent, setSent] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const info = NOTE_KIND_BY_KEY[kind];

    const allowed = React.useMemo(
        () => persons.filter(p => info.about === "both" || p.kind === info.about),
        [persons, info],
    );

    // Сменили тип — имена, которые в него не годятся, отпадают сами: иначе в
    // панихиде остались бы живые, отмеченные при прошлом выборе.
    React.useEffect(() => {
        setPicked(current => {
            const ok = new Set(allowed.map(p => p.id!));
            const next = new Set([...current].filter(id => ok.has(id)));
            return next.size === current.size ? current : next;
        });
    }, [allowed]);

    const toggle = (id: string) => {
        // Отметку «подана» снимаем ЗДЕСЬ, а не внутри обновляющей функции:
        // ту React вправе вызвать дважды, и чужому состоянию там не место.
        setSent(false);
        setPicked(current => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else if (next.size < MAX_NAMES_IN_NOTE) next.add(id);
            return next;
        });
    };

    const chosen = allowed.filter(p => picked.has(p.id!));
    const nameOf = (p: PomyannikPerson) => p.churchName || p.name;
    const formOf = (p: PomyannikPerson) => slavonic[nameOf(p)];

    const groups = (["living", "departed"] as const)
        .map(section => ({ section, list: chosen.filter(p => p.kind === section) }))
        .filter(g => g.list.length);

    const doubtful = chosen.filter(p => formOf(p)?.source !== "lexicon");
    const send = async () => {
        if (!to) return;
        setSending(true);
        setError(null);
        try {
            const response = await fetch("/api/zapiski", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    kind, personIds: chosen.map(p => p.id),
                    code: to.code, slug: to.slug,
                }),
            });
            const body = await response.json().catch(() => null);
            if (!response.ok) { setError(body?.error ?? "не удалось подать записку"); return; }
            setSent(true);
        } finally {
            setSending(false);
        }
    };

    const civilRanks = [...new Set(chosen
        .filter(p => p.rank && !rankChurchGenitive(p.rank, p.sex))
        .map(p => rankGenitive(p.rank, p.sex)))];

    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2 print:hidden">
                <h2 className="font-bold font-serif text-sm">Что подаём</h2>
                <div className="flex flex-wrap gap-x-4 gap-y-1 font-serif text-sm">
                    {offered.map(item => (
                        <label key={item.key} className="flex gap-1 items-center">
                            <input type="radio" name="kind" checked={kind === item.key}
                                   onChange={() => setKind(item.key)} />
                            {item.label}
                        </label>
                    ))}
                </div>
                {info.note && <p className="font-serif text-xs text-slate-500">{info.note}</p>}
            </div>

            <div className="flex flex-col gap-2 print:hidden">
                <h2 className="font-bold font-serif text-sm">
                    Кого вписать
                    <span className="font-normal text-slate-400"> · {picked.size} из {MAX_NAMES_IN_NOTE}</span>
                </h2>
                {allowed.length === 0 ? (
                    <p className="font-serif text-sm text-slate-500">
                        В помяннике нет имён, какие годятся для этого поминовения.
                    </p>
                ) : (
                    <div className="flex flex-col sm:flex-row gap-8">
                        {(["living", "departed"] as const).map(section => {
                            const list = allowed.filter(p => p.kind === section);
                            if (!list.length) return null;
                            return (
                                <div key={section} className="flex-1">
                                    <h3 className="font-serif text-sm text-slate-600 border-b pb-1 mb-1">
                                        {TITLE[section]}
                                    </h3>
                                    <ul>
                                        {list.map(person => (
                                            <li key={person.id}>
                                                <label className="flex gap-2 items-baseline font-serif text-sm py-0.5">
                                                    <input type="checkbox"
                                                           checked={picked.has(person.id!)}
                                                           onChange={() => toggle(person.id!)} />
                                                    <span>{displayName(person)}</span>
                                                </label>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {chosen.length > 0 && (
                <>
                    {/* Сама записка: на печати остаётся только она */}
                    <div className="border rounded p-5 bg-white max-w-sm">
                        <p className="font-serif text-center text-sm text-slate-600 mb-3">
                            {info.label}
                        </p>
                        {groups.map(({ section, list }) => (
                            <div key={section} className="mb-4">
                                <p className="font-sans-serif text-center text-lg mb-1">
                                    {section === "living" ? "ѡ здра́вїи" : "ѡ ᲂу҆поко́енїи"}
                                </p>
                                <ul className="font-sans-serif text-lg text-center leading-relaxed">
                                    {list.map(person => (
                                        <li key={person.id}>
                                            {/* Помета славянским письмом, если оно
                                                засвидетельствовано книгой; иначе
                                                гражданкой — и об этом сказано ниже */}
                                            {rankChurchGenitive(person.rank, person.sex)
                                                ?? (rankGenitive(person.rank, person.sex)
                                                    ? <span className="font-serif text-base">
                                                          {rankGenitive(person.rank, person.sex)}
                                                      </span>
                                                    : null)}
                                            {person.rank ? " " : ""}
                                            {formOf(person)?.genitive ?? nameOf(person)}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>

                    {civilRanks.length > 0 && (
                        <p className="font-serif text-sm text-slate-600 max-w-2xl print:hidden">
                            Пометы {civilRanks.join(", ")} стоят гражданским письмом: их
                            церковнославянского написания нет ни в нашем словаре, ни в служебных
                            книгах собрания, а <strong>придумывать его за книгу мы не станем</strong>.
                        </p>
                    )}

                    {doubtful.length > 0 && (
                        <p className="font-serif text-sm text-amber-700 max-w-2xl print:hidden">
                            <strong>Проверьте эти имена:</strong>{" "}
                            {doubtful.map(p => nameOf(p)).join(", ")} — их нет в нашем
                            церковнославянском словаре, и склонить их мы не смогли. В записке
                            они стоят в том падеже, в каком вы их вписали.
                        </p>
                    )}

                    {error && (
                        <p className="font-serif text-sm text-amber-700 print:hidden">{error}</p>
                    )}

                    {/* Когда есть кому подать, подача идёт первой: печать здесь
                        запасной путь, а не главный. Имя принимающего в кнопку не
                        ставим — оно требует дательного падежа («подать иерею
                        Николаю»), а склонять сан с именем мы не умеем и врать
                        согласованием не станем: кому подаём, сказано выше */}
                    <div className="flex flex-wrap gap-3 items-center print:hidden">
                        {to && (sent ? (
                            <span className="font-serif text-sm text-slate-700">
                                Записка подана — {to.title} увидит её у себя.
                            </span>
                        ) : (
                            <button className={BUTTON} onClick={send} disabled={sending}>
                                {sending ? "подаём…" : "подать записку"}
                            </button>
                        ))}
                        <button className={BUTTON} onClick={() => window.print()}>
                            печатать
                        </button>
                    </div>
                </>
            )}

            <p className="font-serif text-sm print:hidden">
                <Link href="/pomyannik" className="text-red-900 hover:underline">← помянник</Link>
            </p>
        </div>
    );
};

export default Zapiska;

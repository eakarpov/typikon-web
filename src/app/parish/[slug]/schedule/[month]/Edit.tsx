"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Gathering } from "@/lib/parish/types";

// Правка прямо в сетке месяца, а не в отдельной админке.
//
// Ответственный правит расписание, глядя на расписание: час, который он ставит,
// имеет смысл только рядом с соседними часами того же дня. Уводить его на
// отдельный экран значило бы просить держать месяц в голове.

const post = (slug: string, body: unknown) =>
    fetch(`/api/parish/${slug}/edits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

export interface DayMarks {
    sign: string; dayVariant: string; weekday: string;
    dvunadesyaty: boolean; prestolny: boolean; triod: string | null;
}

export const EditGathering = ({ slug, month, g, day }: {
    slug: string; month: string; g: Gathering; day?: DayMarks;
}) => {
    const router = useRouter();
    const [pending, start] = useTransition();
    const [time, setTime] = useState(g.time ?? "");
    const [open, setOpen] = useState(false);
    const [promote, setPromote] = useState(false);
    const [scope, setScope] = useState("dayVariant");

    const save = (op: "time" | "title" | "cancel", value: Record<string, string>) =>
        start(async () => {
            await post(slug, {
                month, date: g.civil, part: g.part, gatheringKey: g.key, op, value,
                // ОСНОВАНИЕ ЗАПИСЫВАЕТСЯ ВМЕСТЕ С ПРАВКОЙ: только по нему потом
                // и узнаешь, что устав с тех пор передумал
                baseline: { time: g.time, title: g.title },
            });
            router.refresh();
        });

    // ЧЕТЫРЕ ШИРИНЫ, а не свободное поле: человек, которому дали писать
    // условие, напишет его неверно — и узнает об этом через год
    const SCOPES: [string, string, () => Record<string, unknown>][] = day ? [
        ["dayVariant", `по всем таким дням (${
            { voskresny: "воскресеньям", subbotny: "субботам", sedmichny: "седмичным" }
                [day.dayVariant] ?? day.dayVariant})`,
         () => ({ part: g.part, dayVariant: [day.dayVariant] })],
        ["sign", `при таком знаке (${day.sign})`,
         () => ({ part: g.part, sign: [day.sign] })],
        ["dvunadesyaty", "во все двунадесятые праздники",
         () => ({ part: g.part, dvunadesyaty: true })],
        ["prestolny", "в престольный праздник",
         () => ({ part: g.part, prestolny: true })],
    ] : [];

    const promoteNow = () => start(async () => {
        const chosen = SCOPES.find(s => s[0] === scope);
        if (!chosen) return;
        await post(slug, {
            promote: {
                key: `svoyo-${scope}-${g.part}`,
                label: `${g.title} — ${chosen[1]}`,
                when: chosen[2](),
                part: g.part, time: g.time ?? undefined, title: g.title,
                note: "заведено из правки расписания",
            },
        });
        setPromote(false);
        router.refresh();
    });

    if (promote && day) {
        return (
            <span style={{ marginLeft: ".5rem", fontSize: ".8rem" }}>
                <select value={scope} onChange={e => setScope(e.target.value)}
                        style={{ border: "1px solid #ccc" }}>
                    {SCOPES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
                <button type="button" disabled={pending} onClick={promoteNow}
                        style={{ marginLeft: ".3rem", color: "#1c5a8a" }}>завести правило</button>
                <button type="button" onClick={() => setPromote(false)}
                        style={{ marginLeft: ".3rem", color: "#999" }}>отмена</button>
            </span>
        );
    }

    return (
        <span style={{ marginLeft: ".5rem", fontSize: ".8rem", whiteSpace: "nowrap" }}>
            {open ? (
                <>
                    <input
                        type="time" value={time} onChange={e => setTime(e.target.value)}
                        style={{ border: "1px solid #ccc", padding: "0 .2rem", width: "6rem" }}
                    />
                    <button type="button" disabled={pending}
                            onClick={() => { save("time", { time }); setOpen(false); }}
                            style={{ marginLeft: ".3rem", color: "#1c5a8a" }}>
                        поставить
                    </button>
                    <button type="button" onClick={() => setOpen(false)}
                            style={{ marginLeft: ".3rem", color: "#999" }}>
                        отмена
                    </button>
                </>
            ) : (
                <>
                    <button type="button" onClick={() => setOpen(true)}
                            style={{ color: "#1c5a8a" }}>
                        час
                    </button>
                    {!g.cancelled && (
                        <button type="button" disabled={pending}
                                onClick={() => save("cancel", {})}
                                style={{ marginLeft: ".5rem", color: "#8a1c1c" }}>
                            не служим
                        </button>
                    )}
                    {/* ПРАВКА, СТАВШАЯ ПРАВИЛОМ. Условие собирается из
                        признаков этого самого дня и ПРЕДЛАГАЕТСЯ — согласиться
                        с ним человек должен сам, глядя на слова */}
                    {g.edited && day && (
                        <button type="button" disabled={pending} onClick={() => setPromote(true)}
                                style={{ marginLeft: ".5rem", color: "#8a6d1c" }}>
                            так у нас всегда
                        </button>
                    )}
                </>
            )}
        </span>
    );
};

export const AddGathering = ({ slug, month, date }: {
    slug: string; month: string; date: string;
}) => {
    const router = useRouter();
    const [pending, start] = useTransition();
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState("Молебен");
    const [time, setTime] = useState("");

    const save = () => start(async () => {
        await post(slug, {
            month, date, part: "utro", op: "add",
            // Собственное собрание от устава не зависит и осиротеть не может:
            // ключ ему даётся свой, по дате и названию
            gatheringKey: `${date}:svoyo:${title.replace(/\s+/g, "-").toLowerCase()}`,
            value: { time, title, services: [title] },
            baseline: {},
            note: "добавлено руками",
        });
        setOpen(false);
        router.refresh();
    });

    if (!open) {
        return (
            <button type="button" onClick={() => setOpen(true)}
                    style={{ fontSize: ".78rem", color: "#1c5a8a" }}>
                + своё
            </button>
        );
    }
    return (
        <div style={{ fontSize: ".8rem", marginTop: ".2rem" }}>
            <input type="time" value={time} onChange={e => setTime(e.target.value)}
                   style={{ border: "1px solid #ccc", width: "6rem" }} />
            <input value={title} onChange={e => setTitle(e.target.value)}
                   placeholder="Молебен, панихида, соборование…"
                   style={{ border: "1px solid #ccc", marginLeft: ".3rem", width: "12rem" }} />
            <button type="button" disabled={pending} onClick={save}
                    style={{ marginLeft: ".3rem", color: "#1c5a8a" }}>добавить</button>
            <button type="button" onClick={() => setOpen(false)}
                    style={{ marginLeft: ".3rem", color: "#999" }}>отмена</button>
        </div>
    );
};

export const DropEdit = ({ slug, id }: { slug: string; id: string }) => {
    const router = useRouter();
    const [pending, start] = useTransition();
    return (
        <button type="button" disabled={pending} style={{ color: "#8a1c1c" }}
                onClick={() => start(async () => {
                    await fetch(`/api/parish/${slug}/edits?id=${encodeURIComponent(id)}`,
                                { method: "DELETE" });
                    router.refresh();
                })}>
            вернуть уставное
        </button>
    );
};

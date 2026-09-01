"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PART_LABELS, type ParishRule } from "@/lib/parish/types";

// Экран правил: откуда взялся каждый час — и как его поменять навсегда.
//
// Показывается УСЛОВИЕ ЧЕЛОВЕЧЕСКИМИ СЛОВАМИ, а не полями: «в воскресенье»,
// «в двунадесятый праздник». Правило, которого нельзя прочесть, нельзя и
// проверить, а проверять его будет тот, кто по нему служит.

const SIGN_WORDS: Record<string, string> = {
    "bdenie": "бдение", "velikoe-bdenie": "великое бдение", "polieley": "полиелей",
    "slavoslovie": "славословие", "shesterichnaya": "шестеричная",
    "bez-znaka": "без знака", "alliluinaya-postnaya": "аллилуйная постная",
    "postnaya-prezhdeosvyashchennaya": "Преждеосвященная",
    "paskha": "Пасха", "po-paskhe": "по Пасхе",
    "strastnaya-pyatok": "Великий Пяток", "strastnaya-subbota": "Великая Суббота",
    "strastnaya-chetvertok": "Великий Четверток",
};
const DAY_WORDS: Record<string, string> = {
    voskresny: "в воскресенье", subbotny: "в субботу", sedmichny: "в седмичный день",
};
const TRIOD_WORDS: Record<string, string> = {
    "velikiy-post": "Великим постом", "strastnaya": "на Страстной",
    "svetlaya-sedmica": "на Светлой седмице",
};

const conditionWords = (r: ParishRule): string => {
    const w = r.when, parts: string[] = [];
    if (w.date) parts.push(`${w.date}`);
    if (w.paschaOffset !== undefined) parts.push(`${w.paschaOffset} дней от Пасхи`);
    if (w.triod?.length) parts.push(w.triod.map(t => TRIOD_WORDS[t] ?? t).join(" или "));
    if (w.dayVariant?.length) parts.push(w.dayVariant.map(d => DAY_WORDS[d] ?? d).join(" или "));
    if (w.dvunadesyaty) parts.push("в двунадесятый праздник");
    if (w.prestolny) parts.push("в престольный праздник");
    if (w.sign?.length) parts.push(`при знаке: ${w.sign.map(s => SIGN_WORDS[s] ?? s).join(", ")}`);
    if (w.hasService?.length) parts.push(`когда есть ${w.hasService.join(", ")}`);
    if (w.part) parts.push(PART_LABELS[w.part]);
    return parts.join(", ") || "всегда";
};

const Rule = ({ slug, r }: { slug: string; r: ParishRule }) => {
    const router = useRouter();
    const [pending, start] = useTransition();
    const [open, setOpen] = useState(false);
    const time = r.then.set?.time ?? r.then.gatherings?.[0]?.time ?? "";
    const [value, setValue] = useState(time);

    const save = () => start(async () => {
        await fetch(`/api/parish/${slug}/settings`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rule: { key: r.key,
                then: { ...r.then, set: { ...(r.then.set ?? { part: r.when.part ?? "utro" }),
                                          time: value } } } }),
        });
        setOpen(false);
        router.refresh();
    });

    return (
        <div style={{ borderTop: "1px solid #eee", padding: ".6rem 0" }}>
            <div>
                <b>{r.label}</b>
                {r.source === "parish" && (
                    <span style={{ color: "#8a6d1c", fontSize: ".85rem" }}> · ваше</span>
                )}
                {r.enabled === false && (
                    <span style={{ color: "#888", fontSize: ".85rem" }}> · выключено</span>
                )}
            </div>
            <div style={{ fontSize: ".88rem", color: "#555" }}>{conditionWords(r)}</div>
            {r.note && (
                <div style={{ fontSize: ".85rem", color: "#777", marginTop: ".15rem" }}>{r.note}</div>
            )}
            <div style={{ fontSize: ".88rem", marginTop: ".3rem" }}>
                {time ? <>час: <b>{time}</b></> : <span style={{ color: "#999" }}>часа не ставит</span>}
                {" · "}
                {open ? (
                    <>
                        <input type="time" value={value} onChange={e => setValue(e.target.value)}
                               style={{ border: "1px solid #ccc", width: "6rem" }} />
                        <button type="button" disabled={pending} onClick={save}
                                style={{ marginLeft: ".3rem", color: "#1c5a8a" }}>поставить</button>
                        <button type="button" onClick={() => setOpen(false)}
                                style={{ marginLeft: ".3rem", color: "#999" }}>отмена</button>
                    </>
                ) : (
                    <button type="button" onClick={() => setOpen(true)} style={{ color: "#1c5a8a" }}>
                        поменять
                    </button>
                )}
            </div>
        </div>
    );
};

export const Rules = ({ slug, rules, own, timezone, timezoneHow, zones }: {
    slug: string; rules: ParishRule[]; own: boolean;
    timezone: string; timezoneHow: string | null; zones: string[];
}) => {
    const router = useRouter();
    const [pending, start] = useTransition();
    const [tz, setTz] = useState(timezone);

    const call = (body: object) => start(async () => {
        await fetch(`/api/parish/${slug}/settings`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        router.refresh();
    });

    return (
        <div style={{ maxWidth: "44rem" }}>
            <div style={{ padding: ".6rem .75rem", background: "#f7f7f7", marginBottom: "1rem" }}>
                <b>Часовой пояс</b>{" "}
                <select value={tz} onChange={e => setTz(e.target.value)}
                        style={{ border: "1px solid #ccc", padding: ".2rem" }}>
                    {zones.map(z => <option key={z} value={z}>{z}</option>)}
                </select>
                <button type="button" disabled={pending || tz === timezone}
                        onClick={() => call({ timezone: tz })}
                        style={{ marginLeft: ".5rem", color: "#1c5a8a" }}>поставить</button>
                <div style={{ fontSize: ".85rem", color: "#666", marginTop: ".3rem" }}>
                    {timezoneHow === "parish" ? "выбран вами"
                        : timezoneHow === "country" ? "в вашей стране пояс один — ошибиться негде"
                        : timezoneHow === "longitude"
                            ? "выведен по долготе и вами не подтверждён; у пограничных областей "
                              + "он ошибается на час — проверьте"
                            : "не выведен — стоит умолчание"}
                    {". "}Им живёт подписной календарь.
                </div>
            </div>

            <p style={{ color: "#666", fontSize: ".9rem" }}>
                {own
                    ? "Это ваши правила: наши поправки к умолчаниям их больше не касаются."
                    : "Пока это наши умолчания, и поправки к ним доходят до вас сами. "
                      + "Первая же ваша правка скопирует их вам — дальше они ваши."}
            </p>

            {rules.map(r => <Rule key={r.key} slug={slug} r={r} />)}

            {own && (
                <p style={{ marginTop: "1rem", fontSize: ".85rem" }}>
                    <button type="button" disabled={pending} onClick={() => call({ reset: true })}
                            style={{ color: "#8a1c1c" }}>
                        вернуться к нашим умолчаниям
                    </button>
                    <span style={{ color: "#888" }}> — свои правила при этом пропадут</span>
                </p>
            )}
        </div>
    );
};

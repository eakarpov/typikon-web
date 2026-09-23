"use client";
import { useState } from "react";
import { RELIC_KINDS, RELIC_STATES, SOURCE_TYPES } from "@/lib/pilgrimage/relics";

// Форма записи святыни: одна на разбор в админке и на предложение со страницы
// храма. Святого, храм и место принимает и ссылкой на страницу сайта — так их
// проще всего взять: открыть страницу и скопировать адрес.

export interface RelicFormValue {
    saint: string;
    temple: string;
    place: string;
    kind: string;
    state: string;
    where: string;
    visitFrom: string;
    visitTo: string;
    sourceType: string;
    sourceRef: string;
    sourceDate: string;
    sourceNote: string;
    note: string;
}

export const EMPTY_RELIC: RelicFormValue = {
    saint: "", temple: "", place: "", kind: "moshchi", state: "present", where: "",
    visitFrom: "", visitTo: "", sourceType: "news", sourceRef: "", sourceDate: "", sourceNote: "", note: "",
};

export const toPayload = (v: RelicFormValue) => ({
    saint: v.saint, temple: v.temple, place: v.place, kind: v.kind, state: v.state, where: v.where,
    ...(v.state === "visiting" ? { visit: { from: v.visitFrom, to: v.visitTo } } : {}),
    source: { type: v.sourceType, ref: v.sourceRef, date: v.sourceDate, note: v.sourceNote },
    note: v.note,
});

const INPUT = "border rounded px-2 py-1 bg-white w-full";

const RelicForm = ({ initial, fixedTemple, submitLabel, onSubmit }: {
    initial?: Partial<RelicFormValue>;
    /** Храм задан страницей — поле не показываем. */
    fixedTemple?: string;
    submitLabel: string;
    onSubmit: (payload: ReturnType<typeof toPayload>) => Promise<string[] | null>;
}) => {
    const [v, setV] = useState<RelicFormValue>({ ...EMPTY_RELIC, ...initial, ...(fixedTemple ? { temple: fixedTemple } : {}) });
    const [errors, setErrors] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);
    const set = (k: keyof RelicFormValue) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        const errs = await onSubmit(toPayload(v));
        setBusy(false);
        setErrors(errs ?? []);
        if (!errs) setV({ ...EMPTY_RELIC, ...(fixedTemple ? { temple: fixedTemple } : {}) });
    };

    const needsDate = v.sourceType === "news";
    return (
        <form onSubmit={submit} className="font-serif text-sm grid gap-2 max-w-xl">
            <label>Святой — ссылка на страницу святого или номер святцев
                <input className={INPUT} value={v.saint} onChange={set("saint")} placeholder="https://www.typikon.info/saints/…" required />
            </label>
            {!fixedTemple && (
                <>
                    <label>Храм — ссылка на страницу храма
                        <input className={INPUT} value={v.temple} onChange={set("temple")} placeholder="https://www.typikon.info/temples/…" />
                    </label>
                    <label>или место — ссылка на страницу места
                        <input className={INPUT} value={v.place} onChange={set("place")} placeholder="https://www.typikon.info/places/…" />
                    </label>
                </>
            )}
            <div className="grid grid-cols-2 gap-2">
                <label>Что
                    <select className={INPUT} value={v.kind} onChange={set("kind")}>
                        {Object.entries(RELIC_KINDS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                    </select>
                </label>
                <label>Состояние
                    <select className={INPUT} value={v.state} onChange={set("state")}>
                        {Object.entries(RELIC_STATES).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                    </select>
                </label>
            </div>
            {v.state === "visiting" && (
                <div className="grid grid-cols-2 gap-2">
                    <label>С <input type="date" className={INPUT} value={v.visitFrom} onChange={set("visitFrom")} required /></label>
                    <label>По <input type="date" className={INPUT} value={v.visitTo} onChange={set("visitTo")} required /></label>
                </div>
            )}
            <label>Где именно (необязательно)
                <input className={INPUT} value={v.where} onChange={set("where")} placeholder="Троицкий собор, у южной стены" maxLength={200} />
            </label>
            <fieldset className="border rounded p-2 grid gap-2">
                <legend className="px-1">Источник — обязательно</legend>
                <select className={INPUT} value={v.sourceType} onChange={set("sourceType")}>
                    {Object.entries(SOURCE_TYPES).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
                <input className={INPUT} value={v.sourceRef} onChange={set("sourceRef")} required maxLength={500}
                       placeholder={v.sourceType === "book" ? "Автор. Название. Место, год. Страница"
                           : v.sourceType === "wikidata" ? "Q123" : v.sourceType === "parish" ? "кто и когда сообщил" : "https://…"} />
                <label>Дата публикации{needsDate ? "" : " (необязательно)"}
                    <input type="date" className={INPUT} value={v.sourceDate} onChange={set("sourceDate")} required={needsDate} />
                </label>
                <input className={INPUT} value={v.sourceNote} onChange={set("sourceNote")} placeholder="пояснение к источнику (необязательно)" maxLength={1000} />
            </fieldset>
            <label>Примечание (необязательно)
                <textarea className={INPUT} value={v.note} onChange={set("note")} maxLength={1000} rows={2} />
            </label>
            {!!errors.length && (
                <ul className="text-red-800">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
            )}
            <div>
                <button type="submit" disabled={busy} className="border border-amber-800 text-amber-900 rounded px-3 py-1 hover:bg-amber-50 disabled:opacity-60">
                    {busy ? "Сохраняем…" : submitLabel}
                </button>
            </div>
        </form>
    );
};

export default RelicForm;

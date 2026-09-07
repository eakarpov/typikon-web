'use client';
import React from "react";
import { useRouter } from "next/navigation";
import type { PomyannikPerson, PersonKind, Rank, Sex } from "@/lib/pomyannik/types";
import { RANKS } from "@/lib/pomyannik/types";
import { rankLabel } from "@/app/pomyannik/labels";

// КАРТОЧКА ЛИЦА: одна форма, одна кнопка.
//
// Правка приходит на сервер целым лицом, а не по полю (см. service.updatePerson):
// иначе пришлось бы решать, что значит отсутствующее поле — «не трогай» или
// «сотри», — и однажды на этом вопросе потерялась бы дата преставления.

const FIELD = "border rounded px-2 py-1 font-serif bg-white text-sm";
const BUTTON = "border rounded px-3 py-1 bg-slate-50 hover:bg-slate-100 font-serif text-sm";

const Row = ({ label, hint, children }: {
    label: string; hint?: string; children: React.ReactNode;
}) => (
    <label className="flex flex-col gap-1 font-serif text-sm">
        <span className="text-slate-600">
            {label}
            {hint && <span className="text-slate-400 text-xs"> · {hint}</span>}
        </span>
        {children}
    </label>
);

const Card = ({ person }: { person: PomyannikPerson }) => {
    const router = useRouter();
    const [draft, setDraft] = React.useState(person);
    const [busy, setBusy] = React.useState(false);
    const [saved, setSaved] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const set = <K extends keyof PomyannikPerson>(key: K, value: PomyannikPerson[K]) => {
        setDraft(current => ({ ...current, [key]: value }));
        setSaved(false);
    };

    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            const response = await fetch(`/api/pomyannik/${person.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(draft),
            });
            if (!response.ok) { setError("не удалось сохранить"); return; }
            setDraft(await response.json());
            setSaved(true);
            router.refresh();
        } finally {
            setBusy(false);
        }
    };

    const remove = async () => {
        if (!window.confirm(`Убрать ${draft.name} из помянника?`)) return;
        setBusy(true);
        const response = await fetch(`/api/pomyannik/${person.id}`, { method: "DELETE" });
        if (response.ok) { router.push("/pomyannik"); router.refresh(); }
        else { setBusy(false); setError("не удалось убрать"); }
    };

    // Женская форма чина есть не у всякого: у отрока и отроковицы это разные
    // чины, а не род одного.
    const ranks = RANKS.filter(r => !r.only || r.only === draft.kind);

    return (
        <div className="flex flex-col gap-4 max-w-xl">
            <div className="grid sm:grid-cols-2 gap-3">
                <Row label="имя" hint="как пишете вы">
                    <input className={FIELD} value={draft.name}
                           onChange={e => set("name", e.target.value)} />
                </Row>
                <Row label="церковное имя" hint="если оно другое">
                    <input className={FIELD} value={draft.churchName ?? ""}
                           placeholder="—"
                           onChange={e => set("churchName", e.target.value || null)} />
                </Row>

                <Row label="раздел">
                    <select className={FIELD} value={draft.kind}
                            onChange={e => set("kind", e.target.value as PersonKind)}>
                        <option value="living">о здравии</option>
                        <option value="departed">о упокоении</option>
                    </select>
                </Row>
                <Row label="чин или помета">
                    <select className={FIELD} value={draft.rank ?? ""}
                            onChange={e => set("rank", (e.target.value || null) as Rank | null)}>
                        <option value="">—</option>
                        {ranks.map(rank => (
                            <option key={rank.key} value={rank.key}>
                                {rankLabel(rank.key, draft.sex)}
                            </option>
                        ))}
                    </select>
                </Row>

                <Row label="род" hint="от него зависит форма пометы">
                    <select className={FIELD} value={draft.sex ?? ""}
                            onChange={e => set("sex", (e.target.value || null) as Sex)}>
                        <option value="">не указан</option>
                        <option value="m">мужской</option>
                        <option value="f">женский</option>
                    </select>
                </Row>
                <Row label="кем приходится" hint="только для вас, в записку не идёт">
                    <input className={FIELD} value={draft.relation ?? ""} placeholder="мама, крёстный"
                           onChange={e => set("relation", e.target.value || null)} />
                </Row>

                <Row label="день рождения">
                    <input className={FIELD} type="date" value={draft.born ?? ""}
                           onChange={e => set("born", e.target.value || null)} />
                </Row>
                <Row label="день крещения">
                    <input className={FIELD} type="date" value={draft.baptized ?? ""}
                           onChange={e => set("baptized", e.target.value || null)} />
                </Row>

                {draft.kind === "departed" && (
                    <Row label="день преставления">
                        <input className={FIELD} type="date" value={draft.died ?? ""}
                               onChange={e => set("died", e.target.value || null)} />
                    </Row>
                )}

                <Row label="сорокоуст заказан" hint="сорок литургий со дня заказа">
                    <input className={FIELD} type="date" value={draft.sorokoust?.from ?? ""}
                           onChange={e => set("sorokoust",
                               e.target.value ? { from: e.target.value, where: draft.sorokoust?.where ?? null } : null)} />
                </Row>
                {draft.sorokoust && (
                    <Row label="где заказан">
                        <input className={FIELD} value={draft.sorokoust.where ?? ""}
                               placeholder="храм или монастырь"
                               onChange={e => set("sorokoust",
                                   { from: draft.sorokoust!.from, where: e.target.value || null })} />
                    </Row>
                )}
            </div>

            {/* ИМЕНИНЫ ПОСЧИТАНЫ, НО НЕ НАВЯЗАНЫ: обычай народный, и названные
                человеком именины расчёт не перебивает */}
            <div className="font-serif text-sm text-slate-600 border-t pt-3">
                {draft.nameDay?.source === "manual"
                    ? "Именины назначены вами — расчёт по дню рождения их не тронет."
                    : draft.nameDay
                        ? <>Именины посчитаны по дню рождения{draft.nameDay.saint
                            ? <> — память {draft.nameDay.saint}</> : null}. Это{" "}
                            <strong>обычай, а не устав</strong>: назначить их иначе вы вправе.</>
                        : "Именины посчитаются, как только будет известен день рождения."}
            </div>

            {error && <p className="font-serif text-sm text-amber-700">{error}</p>}

            <div className="flex gap-3 items-center">
                <button className={BUTTON} onClick={save} disabled={busy}>сохранить</button>
                <button className={BUTTON} onClick={remove} disabled={busy}>убрать из помянника</button>
                {saved && <span className="font-serif text-sm text-slate-500">сохранено</span>}
            </div>
        </div>
    );
};

export default Card;

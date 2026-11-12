'use client';
import { personalDate, fullDate, dateParts } from "@/lib/pomyannik/dates";
import { TEMPORARY_RANKS, statusRank, temporaryRank, expiredRank } from "@/lib/pomyannik/marks";
import { duplicateCandidates } from "@/lib/pomyannik/duplicates";
import DateField from "../DateField";
import DuplicateHints from "../DuplicateHints";
import React from "react";
import { useRouter } from "next/navigation";
import type { PomyannikPerson, PersonKind, Rank, Sex } from "@/lib/pomyannik/types";
import type { PomyannikGroup } from "@/lib/pomyannik/groups";
import { RANKS } from "@/lib/pomyannik/types";
import type { NameDayOption } from "@/lib/pomyannik/nameday";
import { humanDate, rankLabel } from "@/app/pomyannik/labels";

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

const Card = ({ person, nameDays, groups = [], persons = [] }: {
    person: PomyannikPerson; nameDays: NameDayOption[]; groups?: PomyannikGroup[]; persons?: PomyannikPerson[];
}) => {
    const router = useRouter();
    const [draft, setDraft] = React.useState({...person, rank:statusRank(person), mark:temporaryRank(person)});
    const [busy, setBusy] = React.useState(false);
    const [saved, setSaved] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const set = <K extends keyof PomyannikPerson>(key: K, value: PomyannikPerson[K]) => {
        setDraft(current => ({ ...current, [key]: value }));
        setSaved(false);
    };

    // Какая память сейчас выбрана. Ищем совпадение с записью лица, а не
    // держим отдельное состояние: правка приходит целым лицом, и второй счёт
    // того же самого рано или поздно разошёлся бы с первым.
    const current = draft.nameDay;
    const chosen = current?.source === "manual"
        ? nameDays.find(o =>
            o.nameDay.offset === current.offset
            && o.nameDay.month === current.month
            && o.nameDay.day === current.day
            && o.saint === current.saint)
        : undefined;
    const chosenDay = chosen ? `${chosen.value}:${chosen.saint}` : "";

    const pickDay = (id: string) => {
        const option = nameDays.find(o => `${o.value}:${o.saint}` === id);
        set("nameDay", option ? option.nameDay : null);
    };

    const save = async () => {
        if ([draft.born, draft.baptized, draft.died].some(value => value && !personalDate(value)) || (draft.rankUntil && !fullDate(draft.rankUntil))) {
            setError("Проверьте даты: укажите точную дату, год из четырёх цифр или день и месяц в формате ДД.ММ.");
            return;
        }
        setBusy(true);
        setError(null);
        try {
            const response = await fetch(`/api/pomyannik/${person.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(draft),
            });
            if (!response.ok) { const body = await response.json().catch(() => null); setError(body?.error ?? "не удалось сохранить"); return; }
            const savedPerson = await response.json();
            setDraft(savedPerson);
            setSaved(true);
            router.refresh();
        } catch {
            setError("Не удалось сохранить. Проверьте сеть и повторите.");
        } finally {
            setBusy(false);
        }
    };

    const remove = async () => {
        if (!window.confirm(`Переместить ${draft.name} в корзину? Запись можно будет восстановить.`)) return;
        setBusy(true);
        setError(null);
        try {
            const response = await fetch(`/api/pomyannik/${person.id}`, { method: "DELETE" });
            if (response.ok) { router.push("/pomyannik"); router.refresh(); }
            else setError("Не удалось убрать имя.");
        } catch {
            setError("Не удалось убрать имя. Проверьте сеть и повторите.");
        } finally { setBusy(false); }
    };

    // Женская форма чина есть не у всякого: у отрока и отроковицы это разные
    // чины, а не род одного.
    const ranks = RANKS.filter(r => !r.only || r.only === draft.kind);

    return (
        <fieldset disabled={busy} className="flex flex-col gap-4 max-w-xl min-w-0">
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

                <Row label="подпись для себя" hint="фамилия, прозвище или уточнение; в записку не идёт">
                    <input className={FIELD} value={draft.signature ?? ""} maxLength={120}
                           placeholder="Иванов · университет"
                           onChange={e => set("signature", e.target.value || null)} />
                </Row>

                <Row label="раздел">
                    <select className={FIELD} value={draft.kind}
                            onChange={e => set("kind", e.target.value as PersonKind)}>
                        <option value="living">о здравии</option>
                        <option value="departed">о упокоении</option>
                    </select>
                </Row>
                <Row label="чин / статус">
                    <select className={FIELD} value={draft.rank ?? ""}
                            onChange={e => { set("rank", (e.target.value || null) as Rank | null); }}>
                        <option value="">—</option>
                        {ranks.filter(r => !TEMPORARY_RANKS.includes(r.key)).map(rank => (
                            <option key={rank.key} value={rank.key}>
                                {rankLabel(rank.key, draft.sex)}
                            </option>
                        ))}
                    </select>
                </Row>

                <Row label="временная помета" hint="добавляется к чину независимо">
                    <select className={FIELD} value={draft.mark ?? ""} onChange={e => {set("mark", (e.target.value || null) as Rank | null); set("rankUntil", null);}}>
                        <option value="">—</option>
                        {ranks.filter(r => TEMPORARY_RANKS.includes(r.key)).map(r => <option key={r.key} value={r.key}>{rankLabel(r.key,draft.sex)}</option>)}
                    </select>
                </Row>
                {draft.mark && <Row label="помета действует по" hint="включительно; пусто — без срока">
                    <input type="date" className={FIELD} value={draft.rankUntil ?? ""} onChange={e => set("rankUntil", e.target.value || null)} />
                </Row>}
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

            </div>

            {expiredRank(draft) && <div className="text-amber-800 text-sm" role="status">
                Срок пометы истёк {humanDate(draft.rankUntil)}. Она больше не выводится при чтении и в новых записках. Продлите срок выше или уберите помету.
                <button type="button" className="underline ml-2" onClick={() => { set("mark", null); set("rankUntil", null); }}>Убрать помету</button>
            </div>}
            <DuplicateHints persons={duplicateCandidates(draft, persons)} />

            <fieldset className="font-serif text-sm space-y-2">
                <legend>Группы · не более десяти</legend>
                {groups.length===0&&<p className="text-slate-500">Группы пока не созданы.</p>}
                <div className="flex flex-wrap gap-3">{groups.map(group=><label key={group.id} className="flex gap-2 items-center"><input type="checkbox" checked={draft.groups.includes(group.id)} disabled={!draft.groups.includes(group.id)&&draft.groups.length>=10} onChange={e=>set("groups",e.target.checked?[...draft.groups,group.id]:draft.groups.filter(id=>id!==group.id))}/>{group.name}</label>)}</div>
                <a href="/pomyannik" className="underline text-red-900">Создать группу и добавить несколько имён — в помяннике</a>
            </fieldset>

            <h3 className="font-bold font-serif text-sm border-t pt-3">Даты</h3>
            <div className="grid sm:grid-cols-2 gap-3">
                <DateField label="день рождения" value={draft.born} onChange={value => set("born", value)} />
                <DateField label="день крещения" value={draft.baptized} onChange={value => set("baptized", value)} />
                {draft.kind === "departed" && <DateField label="день преставления" value={draft.died} onChange={value => set("died", value)} />}

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

            <p className="font-serif text-xs text-slate-500">Неизвестные части даты оставьте неизвестными. Если указан только год, напоминание по числу не создаётся. Без года возраст и 3-й, 9-й и 40-й дни не рассчитываются.</p>

            {/* ИМЕНИНЫ ВЫБИРАЮТСЯ, А НЕ ТОЛЬКО СЧИТАЮТСЯ.
                Расчёт по дню рождения — самый ходовой обычай, но у имени памятей
                бывает десяток, и какая из них своя, знает человек, а не мы:
                кого-то крестили в честь другого святого, кому-то именины
                назначили по дню крещения. Прежде здесь стояла одна строка о том,
                что мы посчитали, — и выбрать было нечего. */}
            <h3 className="font-bold font-serif text-sm border-t pt-3">Именины</h3>
            <div className="flex flex-col gap-2">
                <select className={FIELD} value={chosenDay}
                        onChange={e => pickDay(e.target.value)}>
                    <option value="">
                        {dateParts(draft.born)?.month
                            ? "считать по дню рождения — ближайшая память после него"
                            : "считать по дню рождения (нужны день и месяц)"}
                    </option>
                    {nameDays.map(option => (
                        <option key={`${option.value}:${option.saint}`}
                                value={`${option.value}:${option.saint}`}>
                            {humanDate(option.date, false)}
                            {option.movable ? " (память подвижная)" : ""} — {option.saint}
                            {option.guess ? " · имя вынуто из соборной памяти" : ""}
                        </option>
                    ))}
                </select>

                <p className="font-serif text-xs text-slate-500">
                    {draft.nameDay?.source === "manual"
                        ? "Именины назначены вами — расчёт по дню рождения их больше не тронет."
                        : draft.nameDay
                            ? <>Посчитано по дню рождения{draft.nameDay.saint
                                ? <> — память {draft.nameDay.saint}</> : null}.</>
                            : "Пока не посчитано: нужен день рождения либо выбор памяти."}
                    {" "}<strong>Правило это обычай, а не устав</strong>: Церковь единого
                    порядка не устанавливает, и назначить именины иначе вы вправе.
                </p>

                {nameDays.length === 0 && (
                    <p className="font-serif text-xs text-amber-700">
                        Имени «{draft.churchName || draft.name}» в нашем указателе святцев нет,
                        и памятей для выбора мы показать не можем. Указатель выведен нами
                        разбором заголовков и неполон — это не значит, что имени нет в святцах.
                    </p>
                )}
            </div>

            {error && <p role="alert" className="font-serif text-sm text-amber-700">{error}</p>}

            <div className="flex gap-3 items-center">
                <button className={BUTTON} onClick={save} disabled={busy}>сохранить</button>
                <button className={BUTTON} onClick={remove} disabled={busy}>в корзину</button>
                {saved && <span className="font-serif text-sm text-slate-500">сохранено</span>}
            </div>
        </fieldset>
    );
};

export default Card;

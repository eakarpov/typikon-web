'use client';
import { duplicateCandidates, personsWithDuplicates } from "@/lib/pomyannik/duplicates";
import DuplicateHints from "./DuplicateHints";
import { expiredRank } from "@/lib/pomyannik/marks";
import { effectiveRanks } from "@/lib/pomyannik/marks";
import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { movePerson, personMatches } from "@/lib/pomyannik/organization";
import { MAX_BATCH, MAX_PERSONS, type PomyannikPerson, type PersonKind } from "@/lib/pomyannik/types";
import { displayName, humanDate, rankLabel, rankChurchGenitive, rankGenitive } from "@/app/pomyannik/labels";

// РАЗВОРОТ ПОМЯННИКА: слева о здравии, справа о упокоении. Так он разграфлён на
// бумаге, и переучивать человека, у которого этот разворот перед глазами
// двадцать лет, незачем.
//
// БЫСТРАЯ СТРОКА ПОД КАЖДЫМ СТОЛБЦОМ, а не одно поле на страницу: вписывают
// имена не вперемешку, а подряд в свой столбец, и лишний выбор «куда» на каждом
// имени — это лишнее движение тридцать раз подряд.

const FIELD = "border rounded px-2 py-1 font-serif bg-white text-sm";
const BUTTON = "border rounded px-3 py-1 bg-slate-50 hover:bg-slate-100 font-serif text-sm";

const TITLE: Record<PersonKind, string> = {
    living: "О здравии",
    departed: "О упокоении",
};

type Forms = Record<string,{genitive:string;source:string}>;
const Column = ({
    kind, persons, onAdd, onRemove, busy, showSignatures, arranging, onMove, allPersons, filterKey, churchView, forms,
}: {
    churchView:boolean; forms:Forms;
    kind: PersonKind;
    persons: PomyannikPerson[];
    onAdd: (kind: PersonKind, name: string) => Promise<boolean>;
    onRemove: (id: string) => Promise<void>;
    busy: boolean;
    showSignatures: boolean;
    arranging: boolean;
    allPersons: PomyannikPerson[];
    filterKey: string;
    onMove: (id: string, direction: -1 | 1) => Promise<void>;
}) => {
    const [draft, setDraft] = React.useState("");
    const section = React.useRef<HTMLElement>(null);
    const PAGE_SIZE = 100;
    const [page, setPage] = React.useState(0);
    React.useEffect(() => { setPage(0); }, [filterKey]);
    const lastPage = Math.max(0, Math.ceil(persons.length / PAGE_SIZE) - 1);
    const currentPage = Math.min(page, lastPage);
    const offset = currentPage * PAGE_SIZE;
    const shown = persons.slice(offset, offset + PAGE_SIZE);
    const changePage = (next: number) => {
        setPage(next);
        section.current?.scrollIntoView({ block: "start" });
    };


    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        const name = draft.trim();
        if (!name) return;
        if (await onAdd(kind, name)) setDraft("");
    };

    return (
        <section ref={section} className="flex flex-col gap-2 flex-1 min-w-0">
            <h2 className="font-bold font-serif border-b pb-1">
                {TITLE[kind]}
                <span className="text-slate-400 font-normal text-sm"> · {persons.length}</span>
            </h2>

            {persons.length === 0 && (
                <p className="font-serif text-sm text-slate-500">Нет имён для показа.</p>
            )}

            <ul className="flex flex-col">
                {shown.map((person, index) => (
                    <li key={person.id}
                        className="font-serif text-sm py-1 flex gap-2 items-baseline group">
                        {arranging && <span className="flex shrink-0 gap-1">
                            <button type="button" className={BUTTON} disabled={busy || index + offset === 0}
                                aria-label={`Поднять: ${displayName(person)}${person.signature ? `, ${person.signature}` : ""}`}
                                onClick={() => onMove(person.id!, -1)}>↑</button>
                            <button type="button" className={BUTTON} disabled={busy || index + offset === persons.length - 1}
                                aria-label={`Опустить: ${displayName(person)}${person.signature ? `, ${person.signature}` : ""}`}
                                onClick={() => onMove(person.id!, 1)}>↓</button>
                        </span>}
                        <div className="min-w-0 break-words">
                            <Link href={`/pomyannik/${person.id}`}
                                  className="text-slate-800 hover:text-red-900 hover:underline">
                                {churchView ? <span className="font-sans-serif text-2xl">{effectiveRanks(person).map(r=>rankChurchGenitive(r,person.sex)??rankGenitive(r,person.sex)).join(" ")} {forms[person.churchName||person.name]?.genitive??person.churchName??person.name}</span> : <>{effectiveRanks(person).map(r=>rankLabel(r,person.sex)).join(" ")} {displayName(person)}</>}
                            </Link>
                            {showSignatures && person.signature && (
                                <div className="text-slate-500 text-xs">{person.signature}</div>
                            )}
                            {(person.groups ?? []).length > 0 && (
                                <div className="text-slate-400 text-xs">{person.groups.join(" · ")}</div>
                            )}
                        </div>
                        {expiredRank(person) && <Link href={`/pomyannik/${person.id}`} className="text-amber-800 text-xs">Срок пометы истёк</Link>}
                        {person.died && (
                            <span className="text-slate-400 text-xs">
                                † {humanDate(person.died)}
                            </span>
                        )}
                        {person.relation && (
                            <span className="text-slate-400 text-xs">{person.relation}</span>
                        )}
                        {/* ПРАВКА НАЗЫВАЕТСЯ СЛОВОМ. Прежде имя было ссылкой на
                            карточку, и только: щёлкать по имени, чтобы поправить
                            дату, никто не догадывался — выходило, что имя можно
                            лишь завести да убрать */}
                        {/* НА УЗКОМ ЭКРАНЕ ВИДНО ВСЕГДА. Наведения на телефоне
                            нет, и спрятанное «по наведению» там не появляется
                            никогда — а помянник открывают как раз с телефона. */}
                        <span className="ml-auto flex gap-2 shrink-0 opacity-60
                                         sm:opacity-0 sm:group-hover:opacity-100
                                         sm:focus-within:opacity-100">
                            <Link href={`/pomyannik/${person.id}`}
                                  className="text-slate-400 hover:text-red-900 text-xs">
                                править
                            </Link>
                            <button
                                type="button"
                                disabled={busy}
                                aria-label={`Убрать: ${displayName(person)}`}
                                onClick={() => onRemove(person.id!)}
                                title="Переместить в корзину"
                                className="text-slate-300 hover:text-red-900 px-1"
                            >
                                ×
                            </button>
                        </span>
                    </li>
                ))}
            </ul>

            {persons.length > PAGE_SIZE && <nav className="flex flex-wrap gap-2 items-center font-serif text-sm" aria-label={`Страницы: ${TITLE[kind]}`}>
                <span>{offset + 1}–{Math.min(offset + PAGE_SIZE, persons.length)} из {persons.length}</span>
                <button type="button" className={BUTTON} disabled={busy || currentPage === 0} onClick={() => changePage(currentPage - 1)}>Предыдущие 100</button>
                <button type="button" className={BUTTON} disabled={busy || currentPage === lastPage} onClick={() => changePage(currentPage + 1)}>Следующие 100</button>
            </nav>}
            <form onSubmit={submit} className="flex gap-2 pt-1">
                <input
                    className={`${FIELD} flex-1 min-w-0`}
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    aria-label={`Вписать имя: ${TITLE[kind]}`}
                    placeholder="имя"
                    list="pomyannik-names"
                    autoComplete="off"
                    disabled={busy}
                />
                <button className={BUTTON} disabled={busy || !draft.trim()}>вписать</button>
            </form>
            {draft.trim() && <DuplicateHints persons={duplicateCandidates({ name: draft, churchName: null }, allPersons)} />}
        </section>
    );
};

const Book = ({ initial, names, forms = {}, showSignatures: initialShowSignatures }: {
    initial: PomyannikPerson[]; names: string[]; showSignatures: boolean; forms?:Forms;
}) => {
    const router = useRouter();
    const [persons, setPersons] = React.useState(initial);
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [query, setQuery] = React.useState("");
    const [group, setGroup] = React.useState("");
    const [arranging, setArranging] = React.useState(false);
    const [churchView,setChurchView] = React.useState(false);
    const [showSignatures, setShowSignatures] = React.useState(initialShowSignatures);
    React.useEffect(() => { setPersons(initial); }, [initial]);
    const groups = Array.from(new Set(persons.flatMap(person => person.groups ?? [])))
        .sort((a, b) => a.localeCompare(b, "ru"));
    const filtered = persons.filter(person => personMatches(person, query, group));
    const hasFilter = Boolean(query.trim() || group);

    const add = async (kind: PersonKind, name: string): Promise<boolean> => {
        setBusy(true);
        setError(null);
        try {
            const response = await fetch("/api/pomyannik", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, kind, groups: group ? [group] : [] }),
            });
            if (!response.ok) {
                const body = await response.json().catch(() => null);
                throw new Error(body?.error ?? "Не удалось вписать имя.");
            }
            const { persons: created } = await response.json();
            setPersons(current => [...current, ...created]);
            router.refresh();
            return true;
        } catch (e) {
            setError(e instanceof Error ? e.message : "Не удалось вписать имя. Проверьте сеть.");
            return false;
        } finally { setBusy(false); }
    };

    const remove = async (id: string) => {
        if (!window.confirm("Переместить имя в корзину? Его можно будет восстановить.")) return;
        setBusy(true);
        setError(null);
        try {
            const response = await fetch(`/api/pomyannik/${id}`, { method: "DELETE" });
            if (!response.ok) throw new Error("Не удалось убрать имя.");
            setPersons(current => current.filter(p => p.id !== id));
            router.refresh();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Не удалось убрать имя. Проверьте сеть.");
        } finally { setBusy(false); }
    };

    const move = async (id: string, direction: -1 | 1) => {
        const reordered = movePerson(persons, id, direction);
        if (reordered === persons) return;
        setBusy(true);
        setError(null);
        try {
            const response = await fetch("/api/pomyannik/order", {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: reordered.map(person => person.id) }),
            });
            if (!response.ok) {
                const body = await response.json().catch(() => null);
                throw new Error(body?.error ?? "Не удалось сохранить порядок.");
            }
            setPersons(reordered);
            router.refresh();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Не удалось сохранить порядок. Проверьте сеть.");
        } finally { setBusy(false); }
    };

    const changeSignatures = async (value: boolean) => {
        setBusy(true);
        setError(null);
        try {
            const response = await fetch("/api/pomyannik/settings", {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ showSignatures: value }),
            });
            if (!response.ok) throw new Error("Не удалось сохранить настройку подписей.");
            setShowSignatures(value);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Не удалось сохранить настройку. Проверьте сеть.");
        } finally { setBusy(false); }
    };

    const duplicates = React.useMemo(() => personsWithDuplicates(persons), [persons]);
    const of = (kind: PersonKind) => filtered.filter(p => p.kind === kind);

    return (
        <div className="flex flex-col gap-3">
            {error && <p role="alert" className="font-serif text-sm text-amber-700">{error}</p>}
            <div className="flex flex-wrap gap-3 items-end font-serif text-sm">
                <label className="flex flex-col gap-1 flex-1 min-w-0">
                    Поиск по помяннику
                    <input type="search" className={FIELD} value={query}
                        placeholder="Имя, подпись, родство или группа"
                        onChange={e => { setQuery(e.target.value); setArranging(false); }} />
                </label>
                <label className="flex flex-col gap-1 max-w-full">
                    Группа
                    <select className={`${FIELD} max-w-full`} value={group}
                        onChange={e => { setGroup(e.target.value); setArranging(false); }}>
                        <option value="">Все группы</option>
                        {Array.from(new Set([...groups, ...(group ? [group] : [])])).map(name => <option key={name} value={name}>{name}</option>)}
                    </select>
                </label>
                {hasFilter && <button type="button" className={BUTTON}
                    onClick={() => { setQuery(""); setGroup(""); }}>Сбросить фильтры</button>}
            </div>
            <div className="flex flex-wrap items-center gap-4 font-serif text-sm">
                <label className="flex gap-2 items-center"><input type="checkbox" checked={churchView} onChange={e=>setChurchView(e.target.checked)} />Просмотр церковнославянским письмом</label>
                <details className="font-serif text-sm">
                    <summary className="cursor-pointer">Настройки помянника</summary>
                    <div className="flex flex-col gap-2 mt-2">
                        <Link href="/settings#commemoration-title" className="text-red-900 underline">Выбор имён и групп для Псалтири и утренних молитв</Link>
                        <label className="flex items-center gap-2">
                            <input type="checkbox" checked={showSignatures} disabled={busy}
                                onChange={e => changeSignatures(e.target.checked)} />
                            Показывать подписи
                        </label>
                        <p className="text-slate-500">Использовано {persons.length.toLocaleString("ru-RU")} из {MAX_PERSONS.toLocaleString("ru-RU")} записей. За один импорт — до {MAX_BATCH} имён. Корзина не занимает этот лимит.</p>
                    </div>
                </details>
                <button type="button" className={BUTTON} disabled={busy || hasFilter || persons.length < 2}
                    aria-pressed={arranging} onClick={() => setArranging(value => !value)}>
                    {arranging ? "Готово" : "Изменить порядок"}
                </button>
                {hasFilter && <span role="status" className="text-slate-500">Найдено: {filtered.length} из {persons.length}</span>}
            </div>
            {churchView && <p className="font-serif text-xs text-slate-500">Имена в родительном падеже. Для имён вне словаря падеж не проверен; пометы без подтверждённой ЦС формы даны гражданским письмом.</p>}
            {duplicates.length > 0 && <details className="font-serif text-sm"><summary className="cursor-pointer text-amber-800">Похожие записи: {duplicates.length}</summary><DuplicateHints persons={duplicates} /></details>}
            {arranging && <p className="font-serif text-xs text-slate-500">Перемещайте имена стрелками внутри раздела. Порядок сохраняется после каждого перемещения.</p>}
            {hasFilter && <p className="font-serif text-xs text-slate-500">Для изменения порядка сбросьте фильтры.{group && ` Новые имена попадут в группу «${group}».`}</p>}
            <div className="flex flex-col sm:flex-row gap-8" aria-busy={busy}>
                <Column kind="living" persons={of("living")} onAdd={add} onRemove={remove} busy={busy}
                    churchView={churchView} forms={forms} showSignatures={showSignatures} arranging={arranging} onMove={move} allPersons={persons} filterKey={`${query}\0${group}`} />
                <Column kind="departed" persons={of("departed")} onAdd={add} onRemove={remove} busy={busy}
                    churchView={churchView} forms={forms} showSignatures={showSignatures} arranging={arranging} onMove={move} allPersons={persons} filterKey={`${query}\0${group}`} />
            </div>
            {/* Падеж объясняем ЗДЕСЬ, где имена и стоят: в помяннике они в
                именительном, а склоняются только в записке, и человек, не
                увидевший записки, решит, что мы просто не умеем */}
            {persons.length > 0 && (
                <p className="font-serif text-xs text-slate-500 border-t pt-2">
                    Имена стоят так, как вы их вписали. Церковнославянскими и в родительном
                    падеже они станут <strong>в записке</strong>: «Николай» читается
                    «Нїкола́а». Щёлкните имя — в карточке даты рождения и преставления, чин,
                    именины и заказанный сорокоуст. Там же можно добавить подпись и группы.
                </p>
            )}

            <datalist id="pomyannik-names">
                {names.map(name => <option key={name} value={name} />)}
            </datalist>
        </div>
    );
};

export default Book;

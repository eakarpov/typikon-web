"use client";
import { useMemo, useState, useRef, useEffect } from "react";
import { indexEntries, stateOf, labels, type Registry, type State, type Stage } from "./core";
import styles from "./coverage.module.css";

const symbols: Record<Stage, string> = { done: "✓", partial: "◐", pending: "·", not_required: "—" };
const stageLabels: Record<Stage, string> = { done: "Готово", partial: "Частично", pending: "Не подтверждено", not_required: "Не требуется" };
export default function Coverage({ data }: { data: Registry }) {
    const [language, setLanguage] = useState("");
    const [book, setBook] = useState("");
    const [known, setKnown] = useState(false);
    const [status, setStatus] = useState<State | "all">("all");
    const [selected, setSelected] = useState<{ book: string; language: string } | null>(null);
    const dialog = useRef<HTMLDialogElement>(null);
    const index = useMemo(() => indexEntries(data.cells), [data]);
    const entries = (b: string, l: string) => index.get(`${b}/${l}`) ?? [];
    const matches = (b: string, l: string) => {
        const state = stateOf(entries(b, l));
        return (!known || state !== "unsearched") && (status === "all" || state === status);
    };
    const books = data.books.filter(b => b.label.toLocaleLowerCase("ru").includes(book.toLocaleLowerCase("ru")));
    const languages = data.languages.filter(l => `${l.label} ${l.id}`.toLocaleLowerCase("ru").includes(language.toLocaleLowerCase("ru")))
        .filter(l => books.some(b => matches(b.id, l.id)));
    const rows = books.filter(b => languages.some(l => matches(b.id, l.id)));
    useEffect(() => { if (selected) dialog.current?.showModal(); }, [selected]);
    const counts = data.books.flatMap(b => data.languages.map(l => stateOf(entries(b.id, l.id))))
        .reduce((acc, state) => ({ ...acc, [state]: acc[state] + 1 }), { unsearched: 0, published: 0, not_found: 0, in_progress: 0 });
    return <main className={styles.page}>
        <a href="/admin">← Администрирование</a>
        <h1>Покрытие богослужебных книг</h1>
        <p>{data.books.length} книг · {data.languages.length} языков</p>
        <p className={styles.updated}>Последнее обновление данных: <time dateTime={data.updated_at}>{data.updated_at.split("-").reverse().join(".")}</time></p>
        <ol className={styles.chain} aria-label="Этапы работы с текстом">
            {data.stages.map(s => <li key={s.id}><b>{s.id}</b><span>{s.label}</span></li>)}
        </ol>
        <div className={styles.legend}>{(Object.keys(labels) as State[]).map(s => <span key={s} className={styles[s]}>{labels[s]} · {counts[s]}</span>)}</div>
        <p className={styles.explanation}>✓ готово · ◐ частично · · не подтверждено · — не требуется. Этапы отмечаются независимо. Зелёный — издание выложено с киноварью, графикой и переходами по принятому режиму. Полнота и выверка указаны отдельно. Если в ячейке несколько изданий, цвет учитывает их все.</p>
        <details className={styles.scope}><summary>Состав реестра и правила учёта</summary><p>{data.scope_note}</p><p>Пустая ячейка означает отсутствие зафиксированного поиска. Красный ставится только по отчёту о поиске. Процент указывается только при известном объёме и подтверждённой проверке. «Распознан» включает извлечённый электронный текст без OCR. В ячейке — самостоятельные издания; этапы разных изданий не складываются.</p><p>Реестр: <code>rules/library/coverage.json</code>. Обновляется вместе с работой над текстами и при публикации.</p></details>
        <div className={styles.filters}>
            <label>Книга<input value={book} onChange={e => setBook(e.target.value)} placeholder="Название книги" /></label>
            <label>Язык<input value={language} onChange={e => setLanguage(e.target.value)} placeholder="Название или код языка" /></label>
            <label>Состояние<select aria-label="Состояние" value={status} onChange={e => setStatus(e.target.value as State | "all")}><option value="all">Все состояния</option>{Object.entries(labels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
            <label className={styles.checkbox}><input type="checkbox" checked={known} onChange={e => setKnown(e.target.checked)} />Только начатое</label>
            <button onClick={() => { setBook(""); setLanguage(""); setStatus("all"); setKnown(false); }}>Сбросить</button>
        </div>
        <p aria-live="polite">Показано: {rows.length} книг × {languages.length} языков. Прокручивайте таблицу по горизонтали; нажмите ячейку для подробностей.</p>
        <div className={styles.scroll} tabIndex={0} aria-label="Матрица книг и языков">
            <table><caption className={styles.srOnly}>Книги по строкам, языки по колонкам</caption><thead><tr><th scope="col">Книга / язык</th>{languages.map(l => <th scope="col" key={l.id}>{l.label}<small>{l.id}</small></th>)}</tr></thead>
                <tbody>{rows.map(b => <tr key={b.id}><th scope="row">{b.label}</th>{languages.map(l => {
                    const list = entries(b.id, l.id); const state = stateOf(list); const visible = matches(b.id, l.id);
                    return <td key={l.id} className={visible ? styles[state] : styles.muted}>
                        <button className={styles.cell} onClick={() => setSelected({ book: b.id, language: l.id })} aria-label={`${b.label}, ${l.label}: ${labels[state]}`}>
                            <strong>{labels[state]}</strong>
                            {list.length ? list.map((e, i) => <div key={i} className={styles.witness}>
                                {list.length > 1 && <span className={styles.edition}>{e.edition ?? `Источник ${i + 1}`} · {labels[e.status]}</span>}
                                <span className={styles.quality}>{e.quality.percent === null ? e.quality.label : `${e.quality.percent}% · ${e.quality.label}`}</span>
                                <span className={styles.steps}>{e.stages.map((s, j) => <span key={j} data-stage={s} title={`${j + 1}. ${data.stages[j].label}: ${stageLabels[s]}`} aria-label={`${data.stages[j].label}: ${stageLabels[s]}`}>{j + 1}{symbols[s]}</span>)}</span>
                                {!!e.tags.length && <span className={styles.tags}>{e.tags.map(t => <span key={t}>{t}</span>)}</span>}
                            </div>) : <span className={styles.quality}>Данных о полноте нет</span>}
                            {!!list.length && <small className={styles.cellDate}>Обновлено: <time dateTime={list.map(e => e.updated_at).sort().at(-1)}>{list.map(e => e.updated_at).sort().at(-1)?.split("-").reverse().join(".")}</time></small>}
                        </button>
                    </td>;
                })}</tr>)}</tbody></table>
        </div>
        {!rows.length && <p>Нет ячеек по выбранным условиям.</p>}
        <dialog ref={dialog} className={styles.dialog} onClose={() => setSelected(null)}>
            {selected && <><button className={styles.close} onClick={() => dialog.current?.close()} autoFocus>Закрыть ×</button><h2>{data.books.find(b => b.id === selected.book)?.label} · {data.languages.find(l => l.id === selected.language)?.label}</h2>
                {entries(selected.book, selected.language).length ? entries(selected.book, selected.language).map((e, i) => <section key={i}>
                    <h3>{e.edition ?? "Источник"} · {labels[e.status]}</h3><p>{e.quality.label}</p><p>{e.tags.join(" · ")}</p>
                    <ol>{e.stages.map((s, j) => <li key={j}>{symbols[s]} {data.stages[j].label} — {stageLabels[s]}</li>)}</ol>
                    {e.alias && <p><a href={`/library/${e.alias}`} target="_blank" rel="noreferrer">Открыть полную книгу ↗</a></p>}
                    <p>Обновлено: {e.updated_at}</p><strong>Основания</strong><ul>{e.evidence.map(v => <li key={v}><code>{v}</code></li>)}</ul>{e.search_note && <p>{e.search_note}</p>}
                </section>) : <p>Поиск источника для этой пары пока не зафиксирован. Существование полного перевода не установлено.</p>}
            </>}
        </dialog>
    </main>;
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BOOK_LANGUAGES } from "@/utils/bookLanguages";
import { BIBLE_LANGUAGE_OPTIONS } from "@/utils/bibleLanguage";
import { revalidateBible } from "@/lib/admin/revalidate";
import type { AdminBook, AdminEdition } from "@/app/admin/bible/api";

interface EditorVerse {
    id: string;
    chapter: number;
    verse: number;
    canonChapter: number;
    canonVerse: number;
    content: string;
}

const EditionForm = ({ edition }: { edition: AdminEdition }) => {
    const [form, setForm] = useState(edition);
    const [saved, setSaved] = useState(false);

    const set = (patch: Partial<AdminEdition>) => {
        setForm((current) => ({ ...current, ...patch }));
        setSaved(false);
    };

    const submit = useCallback(() => {
        fetch(`/api/admin/bible/editions/${form.code}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
        }).then(() => {
            setSaved(true);
            revalidateBible();
        });
    }, [form]);

    return (
        <div className="flex flex-col gap-1 max-w-2xl">
            <label>Название</label>
            <input className="border-2" value={form.title} onChange={(e) => set({ title: e.target.value })} />

            <label>Короткое название (подпись колонки в параллельном виде)</label>
            <input className="border-2 w-24" value={form.shortTitle} onChange={(e) => set({ shortTitle: e.target.value })} />

            <label>Язык выбора зачал (значение cookie bibleLang)</label>
            <select className="border-2" value={form.langCode} onChange={(e) => set({ langCode: e.target.value })}>
                {BIBLE_LANGUAGE_OPTIONS.map((option) => (
                    <option key={option.code} value={option.code}>{option.code} — {option.label}</option>
                ))}
            </select>

            <label>Начертание (каким шрифтом показывать)</label>
            <select className="border-2" value={form.language} onChange={(e) => set({ language: e.target.value })}>
                {BOOK_LANGUAGES.map((language) => (
                    <option key={language.code} value={language.code}>{language.label}</option>
                ))}
            </select>

            <label className="mt-1">
                <input
                    type="checkbox"
                    className="mr-2"
                    checked={form.isDefaultForLang}
                    onChange={(e) => set({ isDefaultForLang: e.target.checked })}
                />
                Издание по умолчанию для этого языка
                <span className="text-stone-500"> — у остальных изданий языка отметка снимется</span>
            </label>

            <label className="mt-1">
                <input
                    type="checkbox"
                    className="mr-2"
                    checked={form.public}
                    onChange={(e) => set({ public: e.target.checked })}
                />
                Показывать в разделе Библии
            </label>

            <label>Традиция нумерации</label>
            <input
                className="border-2"
                value={form.versification}
                onChange={(e) => set({ versification: e.target.value })}
            />

            <label>Год</label>
            <input
                className="border-2 w-32"
                value={form.year ?? ""}
                onChange={(e) => set({ year: e.target.value === "" ? null : Number(e.target.value) })}
            />

            <label>Ссылка на источник</label>
            <input className="border-2" value={form.sourceLink} onChange={(e) => set({ sourceLink: e.target.value })} />

            <label>Порядок</label>
            <input
                className="border-2 w-20"
                value={form.order}
                onChange={(e) => set({ order: Number(e.target.value) || 0 })}
            />

            <p className="cursor-pointer mt-2" onClick={submit}>
                <b>{saved ? "Сохранено!" : "Сохранить издание"}</b>
            </p>

            {form.mapping.length > 0 && (
                <div className="mt-2 text-sm">
                    <p className="font-bold">Правила приведения к канону ({form.mapping.length})</p>
                    {/* Правила живут в src/lib/bible/mappings.ts — в гите, с тестами на
                        каждое. Здесь они только показаны: правка через форму разошлась
                        бы с тем, что уже посчитано в canonRef у стихов. */}
                    <p className="text-stone-500">
                        Правятся в коде (<code>src/lib/bible/mappings.ts</code>), затем пересчитывается
                        канон: <code>npx tsx src/scripts/recompute-bible-canon.ts --apply</code>
                    </p>
                    <ul className="mt-1 space-y-0.5">
                        {form.mapping.map((rule, index) => (
                            <li key={index} className={rule.exact ? "" : "text-amber-700"}>
                                {rule.exact ? "точное" : "приблизительное"} — {rule.note}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

const BookEditor = ({ book }: { book: AdminBook }) => {
    const [verses, setVerses] = useState<EditorVerse[]>([]);
    const [chapter, setChapter] = useState<number | null>(null);
    const [bulk, setBulk] = useState("");
    const [message, setMessage] = useState("");
    const [loaded, setLoaded] = useState(false);

    const load = useCallback(() => {
        fetch(`/api/admin/bible/books/${book.id}/verses`)
            .then((response) => response.json())
            .then((rows: EditorVerse[]) => {
                setVerses(rows);
                setLoaded(true);
                if (rows.length) setChapter((current) => current ?? rows[0].chapter);
            })
            .catch(() => setMessage("Не удалось загрузить стихи"));
    }, [book.id]);

    useEffect(() => { load(); }, [load]);

    const chapters = useMemo(
        () => Array.from(new Set(verses.map((v) => v.chapter))).sort((a, b) => a - b),
        [verses],
    );
    const shown = useMemo(
        () => verses.filter((v) => v.chapter === chapter),
        [verses, chapter],
    );

    const saveVerse = (verse: EditorVerse) => {
        fetch(`/api/admin/bible/verses/${verse.id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: verse.content }),
        }).then(() => {
            setMessage(`Сохранён стих ${verse.chapter}:${verse.verse}`);
            revalidateBible();
        });
    };

    const replaceAll = () => {
        fetch(`/api/admin/bible/books/${book.id}/verses`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: bulk }),
        })
            .then((response) => response.json())
            .then((result) => {
                if (result.error) {
                    setMessage(result.error);
                    return;
                }
                setMessage(`Заменено стихов: ${result.count}`);
                setBulk("");
                revalidateBible();
                load();
            });
    };

    return (
        <div className="border-l-2 pl-3 mt-2">
            <p className="text-sm text-stone-500">
                слуг <code>{book.slug}</code>, прежний адрес <code>{book.alias}</code>
            </p>

            <label className="block mt-2">
                Заменить все стихи книги. Формат построчно: «глава:стих текст», либо строка
                «Глава N» и далее «стих текст». Каноническая ссылка пересчитается правилами
                издания сама.
            </label>
            <textarea
                className="border-2 h-24 w-full"
                value={bulk}
                onChange={(e) => setBulk(e.target.value)}
                placeholder={"1:1 В начале сотворил Бог небо и землю.\n1:2 Земля же была..."}
            />
            <p className="cursor-pointer" onClick={replaceAll}><b>Заменить все стихи</b></p>

            {message && <p className="text-red-800">{message}</p>}

            {loaded && (
                <>
                    <p className="mt-2">
                        <b>Стихи</b> (всего {verses.length})
                    </p>
                    <p className="space-x-1 text-sm">
                        {chapters.map((number) => (
                            <span
                                key={number}
                                className={`cursor-pointer ${number === chapter ? "font-bold text-red-800" : "text-stone-500"}`}
                                onClick={() => setChapter(number)}
                            >
                                {number}
                            </span>
                        ))}
                    </p>
                    {shown.map((verse) => (
                        <div key={verse.id} className="flex flex-row gap-2 items-start mt-1">
                            <span className="text-red-700 text-sm w-20 shrink-0 pt-1">
                                {verse.chapter}:{verse.verse}
                                {/* Каноническое место подписано там, где оно не совпадает
                                    с напечатанным: по нему стих находят зачала. */}
                                {(verse.canonChapter !== verse.chapter || verse.canonVerse !== verse.verse) && (
                                    <span className="text-stone-400"> →{verse.canonChapter}:{verse.canonVerse}</span>
                                )}
                            </span>
                            <textarea
                                className="border-2 flex-1 h-14"
                                value={verse.content}
                                onChange={(e) => setVerses((rows) => rows.map((row) =>
                                    row.id === verse.id ? { ...row, content: e.target.value } : row))}
                            />
                            <span className="cursor-pointer pt-1" onClick={() => saveVerse(verse)}>💾</span>
                        </div>
                    ))}
                </>
            )}
        </div>
    );
};

const Content = ({ editions }: { editions: AdminEdition[] }) => {
    const [openBook, setOpenBook] = useState<string | null>(null);

    if (!editions.length) {
        return (
            <p>
                Изданий нет. Перенос из старых коллекций —{" "}
                <code>npx tsx src/scripts/migrate-bible.ts --apply</code>
            </p>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            {editions.map((edition) => (
                <div key={edition.code}>
                    <p className="font-bold text-lg">
                        {edition.title}{" "}
                        <code className="text-stone-500 text-sm">{edition.code}</code>
                    </p>

                    <EditionForm edition={edition} />

                    <p className="font-bold mt-3">Книги издания ({edition.books.length})</p>
                    <div className="flex flex-col">
                        {edition.books.map((book) => (
                            <div key={book.id} className="border-b py-1">
                                <p>
                                    <span
                                        className="cursor-pointer"
                                        onClick={() => setOpenBook(openBook === book.id ? null : book.id)}
                                    >
                                        {openBook === book.id ? "▾" : "▸"} {book.name}
                                    </span>
                                    <span className="text-stone-500 text-sm">
                                        {" "}— {book.chapters} гл., {book.verses} стихов
                                    </span>
                                    {/* Книга легла в другую книгу канона: сработало правило
                                        приведения. Показываем, потому что иначе «Сусанна»
                                        в списке выглядела бы книгой, которой в каноне нет. */}
                                    {book.remapped && (
                                        <span className="text-amber-700 text-sm">
                                            {" "}→ в каноне это {book.canonName}
                                        </span>
                                    )}
                                    <Link
                                        href={`/bible/${book.canonId}/1?v=${edition.code}`}
                                        className="text-blue-800 text-sm ml-2"
                                        target="_blank"
                                    >
                                        смотреть
                                    </Link>
                                </p>
                                {openBook === book.id && <BookEditor book={book} />}
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default Content;

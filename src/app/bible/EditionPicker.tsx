"use client";

import { useRouter, usePathname } from "next/navigation";
import type { EditionView } from "@/app/bible/api";
import { chapterPath } from "@/app/bible/chapterPath";
import { bibleLanguageShort } from "@/utils/bibleLanguage";

// Выбор изданий для чтения рядом.
//
// ЗАЧЕМ ОТДЕЛЬНАЯ ФИШКА, А НЕ ССЫЛКА «ЧИТАТЬ ВСЕ РЯДОМ». Пока изданий было два,
// выбор «одно или оба» исчерпывался двумя ссылками. С тремя их уже семь, а с
// пятью — тридцать одна, и ссылкой это не выражается. Нужен именно набор:
// читатель сличает славянское с греческим и не хочет видеть румынское, а завтра
// наоборот.
//
// ВЫБОР ЖИВЁТ В АДРЕСЕ, а не в состоянии компонента и не в cookie: по ссылке на
// параллельный вид должно открываться ровно то, что видел отправитель. Поэтому
// щелчок не «запоминается», а переписывает `?v=`, и страница пересобирается на
// сервере с новым набором колонок.
//
// ПОСЛЕДНЕЕ ИЗДАНИЕ СНЯТЬ НЕЛЬЗЯ. Пустой набор — не «покажи всё», а «покажи
// ничего»: `resolveEditionCodes` в этом случае подставит издание языка из
// настроек, и читатель, снявший последнюю галочку, увидел бы не пустоту, а
// внезапно другое издание. Проще не дать снять.
const EditionPicker = ({
    editions,
    selected,
    base,
}: {
    editions: EditionView[];
    selected: string[];
    /**
     * Издание, чьим счётом идёт страница. null — канонический вид, undefined —
     * страница, где вести нечем.
     *
     * ЗНАЧЕНИЯ ПО УМОЛЧАНИЮ ЗДЕСЬ БЫТЬ НЕ ДОЛЖНО. Переключатель счёта показывают
     * по условию `base !== undefined` — то есть «страница передала базу, пусть и
     * пустую». Стояло `base = null`, и оглавление, не передающее базу вовсе,
     * получало её пустой: условие срабатывало, переключатель выходил там, где
     * вести нечего, и уводил на несуществующий адрес.
     */
    base?: string | null;
}) => {
    const router = useRouter();
    const pathname = usePathname();

    if (editions.length < 2) return null;

    const chosen = new Set(selected);

    const go = (codes: string[], nextBase: string | null, chapter?: number) => {
        const query = `?v=${codes.join(",")}${nextBase ? `&base=${nextBase}` : ""}`;
        const here = pathname ?? "";
        const path = chapter === undefined ? here : chapterPath(here, chapter);
        router.replace(`${path}${query}`, { scroll: false });
    };

    const toggle = (code: string) => {
        const next = new Set(chosen);
        if (next.has(code)) {
            if (next.size === 1) return;
            next.delete(code);
        } else {
            next.add(code);
        }

        // Порядок колонок — порядок изданий, а не порядок щелчков: иначе одна и
        // та же пара изданий давала бы разные адреса и разный вид.
        const codes = editions.map((e) => e.code).filter((code) => next.has(code));
        // Сняли то издание, которое вело страницу, — вести больше нечему.
        go(codes, base && next.has(base) ? base : null, base && !next.has(base) ? 1 : undefined);
    };

    // Издания сгруппированы по языку, а не свалены в один ряд: на одном языке их
    // бывает по два — румынский кириллицей и латиницей, чувашский гражданкой и
    // церковной азбукой, славянский никоновский и дониконовский, — и плоским
    // списком из девяти ярлыков не видно, что с чем сравниваешь. Порядок групп —
    // порядок изданий, чтобы славянское осталось первым.
    const groups: Array<{ lang: string; editions: EditionView[] }> = [];
    for (const edition of editions) {
        const group = groups.find((g) => g.lang === edition.langCode);
        if (group) group.editions.push(edition);
        else groups.push({ lang: edition.langCode, editions: [edition] });
    }

    // Ярлык языка ставится только там, где издание в группе не одно: «ГРЕЧ ГРЕЧ»
    // — повтор, а одинокое «ГРЕЧ» язык и называет. Внутри же группы ярлык из
    // названия убирается, иначе выйдет «ЦС · ЦС, ЦС стар.» — и остаётся то, чем
    // издания разнятся: «ЦС · 1751, стар.», «ЧВШ · 2009, ЦРК». Когда после
    // снятия ярлыка не остаётся ничего, издание называет себя годом: у двух
    // изданий одного языка он всегда разный, иначе их незачем держать оба.
    const withinLabel = (edition: EditionView, lang: string, alone: boolean) => {
        if (alone) return edition.shortTitle;
        const prefix = bibleLanguageShort(lang);
        const rest = edition.shortTitle.startsWith(prefix)
            ? edition.shortTitle.slice(prefix.length).trim()
            : edition.shortTitle;
        return rest || (edition.year ? String(edition.year) : edition.shortTitle);
    };

    return (
        <div className="font-serif text-sm flex flex-wrap items-center gap-x-4 gap-y-1">
            {groups.map(({ lang, editions: within }) => (
                <span key={lang} className="inline-flex items-center gap-x-2">
                    {within.length > 1 && (
                        <span className="text-slate-400 text-xs uppercase">{bibleLanguageShort(lang)}</span>
                    )}
                    {within.map((edition) => {
                        const on = chosen.has(edition.code);
                        const last = on && chosen.size === 1;
                        return (
                            <label
                                key={edition.code}
                                title={last ? "Хотя бы одно издание должно остаться" : edition.title}
                                className={`inline-flex items-center gap-1 ${last ? "cursor-default" : "cursor-pointer"}`}
                            >
                                <input
                                    type="checkbox"
                                    checked={on}
                                    disabled={last}
                                    onChange={() => toggle(edition.code)}
                                    className="accent-red-900"
                                />
                                <span className={on ? "text-red-900" : "text-slate-500"}>
                                    {withinLabel(edition, lang, within.length === 1)}
                                </span>
                            </label>
                        );
                    })}
                </span>
            ))}
            <span className="text-slate-400">
                {chosen.size === 1 ? "одно издание" : `рядом: ${chosen.size}`}
            </span>

            {base !== undefined && (
                <span className="flex flex-wrap items-center gap-x-2">
                    <span className="text-slate-400">· счёт:</span>
                    <button
                        type="button"
                        onClick={() => go(editions.filter((e) => chosen.has(e.code)).map((e) => e.code), null, 1)}
                        title="Строки — места канона, славянский счёт; в них попадает всё, что туда кладёт любое издание"
                        className={base === null ? "text-red-900 font-bold" : "text-slate-500 hover:text-red-900"}
                    >
                        по канону
                    </button>
                    {editions.filter((e) => chosen.has(e.code)).map((edition) => (
                        <button
                            key={edition.code}
                            type="button"
                            onClick={() => go(
                                editions.filter((e) => chosen.has(e.code)).map((e) => e.code),
                                edition.code,
                                1,
                            )}
                            title={`Строки ведёт «${edition.title}»: его главы, его порядок стихов`}
                            className={base === edition.code
                                ? "text-red-900 font-bold"
                                : "text-slate-500 hover:text-red-900"}
                        >
                            {edition.shortTitle}
                        </button>
                    ))}
                </span>
            )}
        </div>
    );
};

export default EditionPicker;

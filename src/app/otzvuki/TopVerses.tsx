import Link from "next/link";
import { bibleBook } from "@/utils/bibleBooks";
import type { TopStats, TopVerse } from "@/lib/otzvuki/core";

// Что звучит чаще всего — и почему этот список надо читать с оговоркой.
//
// Верхушку держат не «самые любимые» стихи, а два разных явления: формулы
// («во имя Отца и Сына и Святаго Духа» — Мф. 28:19) и паремии, читаемые
// всякому святому (Прем. 3–4 идёт подряд десятком стихов по 270–450 раз).
// Сказать об этом надо здесь, а не петитом внизу: без оговорки список читают
// как утверждение о благочестии, хотя он — о строении книг.

const verseLabel = (verse: TopVerse) => {
    const book = bibleBook(verse.canonId);
    return `${book?.abbr ?? verse.canonId} ${verse.chapter}:${verse.verse}`;
};

const Column = ({ title, note, verses }: { title: string; note: string; verses: TopVerse[] }) => (
    <div className="flex-1 min-w-[15rem]">
        <h3 className="font-serif text-sm text-slate-800">{title}</h3>
        <p className="font-serif text-xs text-slate-500 mt-0.5">{note}</p>
        <ol className="mt-2 flex flex-col gap-0.5">
            {verses.map((verse) => (
                <li key={verse.canonRef} className="font-serif text-sm flex gap-2 items-baseline">
                    <Link
                        href={`/bible/${verse.canonId}/${verse.chapter}/${verse.verse}`}
                        className="text-red-900 hover:underline"
                    >
                        {verseLabel(verse)}
                    </Link>
                    <span className="text-xs text-slate-500">{verse.count.toLocaleString("ru-RU")}</span>
                </li>
            ))}
        </ol>
    </div>
);

export const TopVerses = ({ top, limit = 15 }: { top: TopStats; limit?: number }) => (
    <section>
        <h2 className="font-serif font-bold text-sm">Что звучит чаще всего</h2>
        <p className="font-serif text-xs text-slate-500 mt-1">
            Список говорит о строении книг, а не о благочестии: наверху стоят
            доксологические формулы и паремии, положенные всякому святому, — то есть
            места, напечатанные много раз, а не выбранные много раз.
        </p>
        <div className="flex flex-wrap gap-8 mt-3">
            <Column
                title="В песнопениях"
                note="процитировано внутри стихиры, тропаря, икоса, ирмоса"
                verses={top.sung.slice(0, limit)}
            />
            <Column
                title="Чтениями"
                note="напечатано паремией, Апостолом, Евангелием, прокимном"
                verses={top.read.slice(0, limit)}
            />
        </div>
    </section>
);

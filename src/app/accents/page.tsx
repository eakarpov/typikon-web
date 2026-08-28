import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { myFont } from "@/utils/font";
import { setMeta } from "@/lib/meta";
import { summarize } from "@/lib/accents/store";
import { cached, CacheTag } from "@/lib/cache";
import MarkForm from "@/app/accents/MarkForm";
import WordLookup from "@/app/accents/WordLookup";

// Словарь ударений лицом к человеку. До сих пор он был доступен только через
// /api/v2/accents, то есть программистам.

export const metadata: Metadata = {
    title: "Ударения — Уставные чтения",
    description:
        "Расставить ударения в церковнославянском тексте и посмотреть, где собрание " +
        "ставит знак в отдельном слове: по книжным чтениям, по песнопениям и по словарю.",
    openGraph: {
        title: "Ударения",
        description: "Расстановка ударений в церковнославянском тексте по словарю собрания.",
        url: "//www.typikon.su/accents/",
    },
};

const counts = cached(summarize, ["accents-page-summary"], [CacheTag.TEXTS]);

const Sources = async () => {
    const summary = await counts();
    const thousands = (n: number) => n.toLocaleString("ru-RU");

    return (
        <p className="font-serif text-sm text-slate-600">
            Словарь собран из трёх источников: {thousands(summary.fromCorpus)} основ из книжных
            чтений, {thousands(summary.fromChants)} из песнопений, {thousands(summary.fromLexicon)} из
            словаря церковнославянского — всего {thousands(summary.words)}. Там, где слово знают
            хотя бы двое ({thousands(summary.compared)}), они сходятся
            в {thousands(summary.agree)} случаях. Те же данные отдаёт{" "}
            <Link href="/api" className="text-amber-800 hover:underline">API</Link>.
        </p>
    );
};

const Accents = () => {
    setMeta();

    return (
        <div className={`${myFont.variable} pt-2 flex flex-col gap-6`}>
            <div className="flex flex-col gap-2">
                <h1 className="font-serif font-bold text-lg">Ударения</h1>
                <p className="font-serif">
                    Где в церковнославянском слове стоит ударение — по тому, как это написано
                    в самих книгах собрания. Вставьте текст, чтобы расставить знаки, или
                    спросите про отдельное слово.
                </p>
                {/* Оговорка стоит вверху, а не петитом внизу: без неё словарь начнут
                    читать как источник нормы, а он говорит только о том, что написано. */}
                <p className="font-serif text-slate-600">
                    Словарь <strong>описательный, а не нормативный</strong>: он говорит, как слово
                    размечено в собраниях и сколько раз, а не как правильно. Где книги расходятся —
                    показываем оба написания и оставляем выбор вам.
                </p>
            </div>

            <section className="flex flex-col gap-2">
                <h2 className="font-serif font-bold">Расставить в тексте</h2>
                <MarkForm />
            </section>

            <section className="flex flex-col gap-2">
                <h2 className="font-serif font-bold">Одно слово</h2>
                <WordLookup />
            </section>

            <section>
                <Suspense fallback={null}>
                    <Sources />
                </Suspense>
            </section>
        </div>
    );
};

export default Accents;

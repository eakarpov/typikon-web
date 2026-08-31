import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { myFont } from "@/utils/font";
import { BIBLE_LANGUAGE_COOKIE, DEFAULT_BIBLE_LANGUAGE } from "@/utils/bibleLanguage";
import EditionPicker from "@/app/bible/EditionPicker";
import { getBibleIndex, resolveEditionCodes } from "@/app/bible/api";
import { bibleScopeTitle, DEFAULT_BIBLE_SCOPE } from "@/utils/bibleScope";
import { coverageNote } from "@/utils/bibleCoverage";
import { absentFromCanon, bibleEditionCanonTitle } from "@/utils/bibleEditionCanon";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Библия — Уставные чтения",
    description:
        "Библия по книгам и главам: церковнославянская Елизаветинская, румынская 1688 года " +
        "и греческая — Септуагинта с Патриаршим текстом. Издания читаются рядом, стих против стиха.",
    openGraph: {
        type: "website",
        url: "//www.typikon.su/bible",
        title: "Библия — Уставные чтения",
        description: "Книги Библии по главам, с параллельным чтением изданий.",
    },
};

const Index = async ({ selected }: { selected: string }) => {
    const { editions, sections } = await getBibleIndex();

    // Пришли из библиотеки или по ссылке на конкретное издание — пусть и оглавление
    // ведёт в него же. А без выбора берём не «все разом», а издание языка из
    // настроек: с тремя изданиями и больше «все разом» — это стена колонок,
    // которую никто не просил.
    const lang = cookies().get(BIBLE_LANGUAGE_COOKIE)?.value || DEFAULT_BIBLE_LANGUAGE;
    const known = selected.split(",").filter((code) => editions.some((e) => e.code === code));
    const chosen = known.length
        ? known
        : (await resolveEditionCodes(undefined, lang)).split(",").filter(Boolean);
    const suffix = chosen.length ? `?v=${chosen.join(",")}` : "";

    return (
        <div className="pt-2 space-y-4">
            <p className="font-serif">
                Библия по книгам и главам. Издания можно читать рядом: стихи сводятся по
                каноническому месту, а не по номеру строки, поэтому напротив славянского стиха
                стоит тот же стих румынского — даже там, где издания разбили текст по-разному.
            </p>

            <div className="font-serif">
                <p className="font-bold">Издания</p>
                <ul className="mt-1 space-y-1">
                    {editions.map((edition) => (
                        <li key={edition.code}>
                            <Link href={`/bible/bytie/1?v=${edition.code}`} className="text-red-900">
                                {edition.title}
                            </Link>
                            {edition.year && <span className="text-slate-500"> — {edition.year}</span>}
                            {/* Объём и покрытие показываем только когда есть что
                                сказать: у полной Библии «полная Библия, отдаёт
                                100% чтений» — шум, а помета должна значить
                                «тут есть чему не найтись». */}
                            {edition.scope !== DEFAULT_BIBLE_SCOPE && (
                                <span className="text-slate-500"> · {bibleScopeTitle(edition.scope)}</span>
                            )}
                            {/* Канон — не то же, что объём: он говорит, чего у
                                традиции нет вовсе. Читателю, сличающему издания,
                                важно знать, что латинская колонка у 3 Маккавейской
                                пуста не по недосмотру. */}
                            {absentFromCanon(edition.canon).length > 0 && (
                                <span className="text-slate-500 text-sm">
                                    {" · "}канон {bibleEditionCanonTitle(edition.canon)}:
                                    {" "}нет {absentFromCanon(edition.canon).join(", ")}
                                </span>
                            )}
                            {coverageNote(edition.coverage) && (
                                <span className="text-amber-700 text-sm"> · {coverageNote(edition.coverage)}</span>
                            )}
                        </li>
                    ))}
                </ul>

                {editions.length > 1 && (
                    <div className="mt-2 space-y-1">
                        <p className="text-slate-500 text-sm">
                            Отметьте, какие читать рядом — оглавление ниже поведёт в них же:
                        </p>
                        <EditionPicker editions={editions} selected={chosen} />
                    </div>
                )}
            </div>

            {sections.map((section) => (
                <div key={section.id} className="font-serif">
                    <p className="font-bold text-red-900">{section.label}</p>
                    <ul className="mt-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4">
                        {section.books.map((book) => (
                            <li key={book.id} title={book.note}>
                                <Link href={`/bible/${book.id}/1${suffix}`} className="hover:text-red-900">
                                    {book.name}
                                </Link>
                                {book.chapters > 0 && (
                                    <span className="text-slate-400 text-sm"> · {book.chapters}</span>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </div>
    );
};

const BiblePage = ({ searchParams }: { searchParams: { v?: string } }) => (
    <div className={myFont.variable}>
        <Suspense fallback={<div>Loading...</div>}>
            <Index selected={searchParams.v || ""} />
        </Suspense>
    </div>
);

export default BiblePage;

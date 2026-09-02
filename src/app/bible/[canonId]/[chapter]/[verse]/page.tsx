import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { myFont } from "@/utils/font";
import { bibleBook } from "@/utils/bibleBooks";
import { canonSortRange, echoesOf } from "@/lib/citations";
import { ChantCard } from "@/app/chants/ChantCard";

// Где ещё звучит это место Писания.
//
// СВОИМ АДРЕСОМ, А НЕ СЕКЦИЕЙ ПОД ГЛАВОЙ. Три причины, и все три весят.
// У ходового стиха отзвуков сотни — секция вышла бы длиннее самой главы.
// Страница главы устроена вокруг параллели изданий и кэшируется из Монги по
// CacheTag.BIBLE, а цитаты лежат в SQLite и от издания не зависят вовсе:
// смешав их, мы завели бы сброс кэша Библии при каждой пересборке корпуса.
// И наконец отзвуку нужен постоянный адрес — вести на него будут и глава, и
// список под песнопением, и библейские сноски в чтениях.

export const dynamic = "force-dynamic";

const PAGE = 30;

type Props = {
    params: { canonId: string; chapter: string; verse: string };
    searchParams: { page?: string; all?: string };
};

const num = (raw: string): number | null => {
    const value = Number(raw);
    return Number.isInteger(value) && value > 0 ? value : null;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const canon = bibleBook(params.canonId);
    const chapter = num(params.chapter);
    const verse = num(params.verse);
    if (!canon || !chapter || !verse) return { title: "Библия — Уставные чтения" };
    return {
        title: `${canon.abbr} ${chapter}:${verse} в песнопениях — Уставные чтения`,
        description: `В каких песнопениях церковного года звучит ${canon.name} ${chapter}:${verse}.`,
    };
}

const EchoesPage = async ({ params, searchParams }: Props) => {
    const canon = bibleBook(params.canonId);
    const chapter = num(params.chapter);
    const verse = num(params.verse);
    if (!canon || !chapter || !verse) notFound();

    const page = Math.max(1, Number(searchParams.page) || 1);
    // Догадки — трёхсловные созвучия: по умолчанию их нет, но спросить можно.
    const certainOnly = searchParams.all !== "1";
    const [from, to] = canonSortRange(chapter, verse);
    const found = echoesOf(params.canonId, from, to, { certainOnly },
                           PAGE, (page - 1) * PAGE);

    const where = `${canon.name} ${chapter}:${verse}`;

    return (
        <div className={`${myFont.variable} pt-2`}>
            <p className="font-serif text-sm">
                <Link href={`/bible/${canon.id}/${chapter}#v${verse}`} className="text-red-900">
                    ← {where}
                </Link>
            </p>
            <h1 className="font-bold font-serif mt-2">{where} в песнопениях</h1>

            {found === null ? (
                <p className="font-serif text-slate-600 mt-4">
                    Корпус певческих текстов на этом сервере пока не выложен.
                </p>
            ) : !found.total ? (
                <p className="font-serif text-slate-600 mt-4">
                    {certainOnly
                        ? "Дословных отзвуков этого стиха в корпусе не нашлось."
                        : "Отзвуков этого стиха в корпусе не нашлось."}
                    {certainOnly && (
                        <>
                            {" "}
                            <Link href={`?all=1`} className="text-red-900">
                                Показать и короткие созвучия
                            </Link>
                            {" — они чаще общее место богослужебного языка, чем цитата."}
                        </>
                    )}
                </p>
            ) : (
                <>
                    <p className="font-serif text-sm text-slate-500 mt-3 mb-3">
                        Нашлось: {found.total}
                        {certainOnly ? (
                            <>
                                {" · "}
                                <Link href="?all=1" className="text-red-900">
                                    считая короткие созвучия
                                </Link>
                            </>
                        ) : (
                            <>
                                {" · "}
                                <Link href="?" className="text-red-900">
                                    только дословные
                                </Link>
                            </>
                        )}
                    </p>
                    <div className="flex flex-col gap-4">
                        {found.items.map(echo => (
                            <ChantCard key={`${echo.id}-${echo.canonRef}`} hit={echo}>
                                <p className="text-xs text-slate-400 font-serif mt-1">
                                    дословно {echo.words}{" "}
                                    {echo.confidence === "certain" ? "слов" : "слова — созвучие, не цитата"}
                                </p>
                            </ChantCard>
                        ))}
                    </div>
                    {found.total > PAGE && (
                        <div className="flex gap-4 items-baseline font-serif mt-4">
                            {page > 1 && (
                                <Link href={`?page=${page - 1}${certainOnly ? "" : "&all=1"}`} className="text-red-900">
                                    ← назад
                                </Link>
                            )}
                            <span className="text-sm text-slate-500">
                                страница {page} из {Math.ceil(found.total / PAGE)}
                            </span>
                            {page * PAGE < found.total && (
                                <Link href={`?page=${page + 1}${certainOnly ? "" : "&all=1"}`} className="text-red-900">
                                    вперёд →
                                </Link>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default EchoesPage;

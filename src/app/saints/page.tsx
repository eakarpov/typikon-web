import { Suspense } from "react";
import Link from "next/link";
import { Metadata } from "next";
import { setMeta } from "@/lib/meta";
import { myFont } from "@/utils/font";
import { getSaintRows, SAINTS_PER_PAGE } from "@/app/saints/api";
import { saintTitles } from "@/lib/dneslov";

// Указатель святых. До сих пор страницы /saints/[id] существовали, но попасть на них
// можно было только из текста — списка не было нигде, и в карту сайта они не попадали.

export const metadata: Metadata = {
    title: "Святые в собрании",
    description: "Указатель святых, чьи памяти и упоминания встречаются в уставных чтениях собрания.",
    openGraph: {
        title: "Святые в собрании",
        description: "Указатель святых, чьи памяти и упоминания встречаются в уставных чтениях собрания.",
        url: "//www.typikon.su/saints/",
    },
};

const plural = (n: number, one: string, few: string, many: string) => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
    return many;
};

const SaintsList = async ({ page }: { page: number }) => {
    const rows = await getSaintRows();

    const pages = Math.max(1, Math.ceil(rows.length / SAINTS_PER_PAGE));
    const current = Math.min(Math.max(page, 1), pages);
    const shown = rows.slice((current - 1) * SAINTS_PER_PAGE, current * SAINTS_PER_PAGE);

    // Имена запрашиваем только для показанной полусотни: святцы чужие, и тянуть
    // все 840 имён ради одной страницы списка нельзя.
    const titles = await saintTitles(shown.map((item) => item.dneslovId));

    return (
        <>
            <p className="font-serif text-slate-500 mb-2">
                Всего {rows.length} {plural(rows.length, "память", "памяти", "памятей")}; по убыванию числа чтений.
            </p>
            <ul className="flex flex-col gap-1">
                {shown.map((item) => (
                    <li key={item.dneslovId} className="font-serif">
                        <Link className="text-amber-800 hover:underline" href={`/saints/${item.dneslovId}`}>
                            {titles[item.dneslovId]}
                        </Link>
                        <span className="text-sm text-slate-500">
                            {" — "}
                            {!!item.texts && `${item.texts} ${plural(item.texts, "чтение", "чтения", "чтений")}`}
                            {!!item.texts && !!item.mentions && ", "}
                            {!!item.mentions && `${item.mentions} ${plural(item.mentions, "упоминание", "упоминания", "упоминаний")}`}
                        </span>
                    </li>
                ))}
            </ul>
            {pages > 1 && (
                <div className="flex flex-row gap-4 mt-4 font-serif">
                    {current > 1 && (
                        <Link className="text-amber-800 hover:underline" href={`/saints?page=${current - 1}`}>
                            ← Предыдущие
                        </Link>
                    )}
                    <span className="text-slate-500">Страница {current} из {pages}</span>
                    {current < pages && (
                        <Link className="text-amber-800 hover:underline" href={`/saints?page=${current + 1}`}>
                            Следующие →
                        </Link>
                    )}
                </div>
            )}
        </>
    );
};

const Saints = ({ searchParams }: { searchParams?: { page?: string } }) => {
    setMeta();
    const page = Number(searchParams?.page) || 1;

    return (
        <div className="pt-2">
            <div className={myFont.variable}>
                <p className="font-serif">
                    Святые, чьи памяти и упоминания встречаются в чтениях собрания. На странице памяти
                    собраны написанные к ней тексты и те чтения, где о святом говорится по ходу.
                </p>
                <p className="font-serif text-sm text-slate-500 mb-4">
                    Сведения о самих святых — со святцев <Link className="text-amber-800" href="https://dneslov.org" target="_blank" rel="noreferrer">dneslov.org</Link>.
                </p>
                <Suspense fallback={<div>Loading...</div>}>
                    {/* @ts-expect-error Async Server Component */}
                    <SaintsList page={page} />
                </Suspense>
            </div>
        </div>
    );
};

export default Saints;

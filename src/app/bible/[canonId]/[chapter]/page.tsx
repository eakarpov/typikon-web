import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { myFont } from "@/utils/font";
import { BIBLE_LANGUAGE_COOKIE, DEFAULT_BIBLE_LANGUAGE } from "@/utils/bibleLanguage";
import { canonBook } from "@/utils/bibleCanon";
import { referenceChapterCount } from "@/utils/bibleVersification";
import { getChapter, neighbourBooks, resolveEditionCodes } from "@/app/bible/api";
import Chapter from "@/app/bible/[canonId]/[chapter]/Chapter";

// Страница зависит и от адреса (?v=...), и от cookie языка, поэтому остаётся
// динамической; в базу за ней при этом не ходим — выборки кэшируются в api.ts.
export const dynamic = "force-dynamic";

type Props = {
    params: { canonId: string; chapter: string };
    searchParams: { v?: string };
};

const parseChapter = (raw: string): number | null => {
    const chapter = Number(raw);
    return Number.isInteger(chapter) && chapter > 0 ? chapter : null;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const canon = canonBook(params.canonId);
    const chapter = parseChapter(params.chapter);
    if (!canon || !chapter) return { title: "Библия — Уставные чтения" };

    const title = `${canon.name}, глава ${chapter} — Библия — Уставные чтения`;
    return {
        title,
        description: `${canon.name}, глава ${chapter}: церковнославянский и румынский тексты рядом.`,
        openGraph: {
            type: "website",
            url: `//www.typikon.su/bible/${canon.id}/${chapter}`,
            title,
        },
    };
}

// Соседняя глава — сначала внутри книги, а на её краю переходим в соседнюю книгу
// канона: чтение подряд не должно упираться в тупик на последней главе.
const step = (canonId: string, chapter: number, chapters: number[], forward: boolean) => {
    const here = chapters.indexOf(chapter);
    const inside = here >= 0 ? chapters[here + (forward ? 1 : -1)] : undefined;
    if (inside) {
        const canon = canonBook(canonId)!;
        return { canonId, chapter: inside, label: `${canon.abbr} ${inside}` };
    }

    const { previous, next } = neighbourBooks(canonId);
    const neighbour = forward ? next : previous;
    if (!neighbour) return null;

    // К предыдущей книге переходим на её последнюю главу, а не на первую.
    const last = referenceChapterCount(neighbour.id);
    const target = forward ? 1 : Math.max(1, last);
    return { canonId: neighbour.id, chapter: target, label: `${neighbour.name} ${target}` };
};

const ChapterPage = async ({ params, searchParams }: Props) => {
    const chapter = parseChapter(params.chapter);
    if (!chapter || !canonBook(params.canonId)) notFound();

    const lang = (await cookies()).get(BIBLE_LANGUAGE_COOKIE)?.value || DEFAULT_BIBLE_LANGUAGE;
    const codes = await resolveEditionCodes(searchParams.v, lang);

    const data = await getChapter(params.canonId, chapter, codes);
    if (!data) notFound();

    return (
        <div className={myFont.variable}>
            <Chapter
                data={data}
                codes={codes}
                previous={step(params.canonId, chapter, data.chapters, false)}
                next={step(params.canonId, chapter, data.chapters, true)}
            />
        </div>
    );
};

export default ChapterPage;

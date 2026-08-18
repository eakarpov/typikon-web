import {calcDay} from "@/lib/calcDay";
import {Suspense} from "react";
import Content from "@/app/calculator/[date]/Content";
import {setMeta} from "@/lib/meta";
import {Metadata} from "next";
import {cookies} from "next/headers";
import {BIBLE_LANGUAGE_COOKIE, DEFAULT_BIBLE_LANGUAGE} from "@/utils/bibleLanguage";
import {notFound} from "next/navigation";

type Props = {
    params: { date: string };
};

const isValidDateParam = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(new Date(date).getTime());

export async function generateMetadata(
    { params }: Props,
): Promise<Metadata> {
    const { date } = params;

    return {
        title: `Уставные чтения на день: ${date}`,
        description: `Полные уставные чтения (Триодь и календарь) на ${date}.`,
        openGraph: {
            type: "website",
            url: `//www.typikon.su/calculator/${date}`,
            title: `Уставные чтения на день: ${date}`,
            description: `Полные уставные чтения (Триодь и календарь) на ${date}.`,
        },
    }
}

const CalculatorDate = async ({ params: { date } }: Props) => {
    setMeta();

    if (!isValidDateParam(date)) {
        notFound();
    }

    const lang = (await cookies()).get(BIBLE_LANGUAGE_COOKIE)?.value || DEFAULT_BIBLE_LANGUAGE;
    const resultPromise = calcDay(date, lang);

    return (
        <div>
            <Suspense fallback={<div>Loading...</div>}>
                {/* @ts-expect-error Async Server Component */}
                <Content date={date} resultPromise={resultPromise} />
            </Suspense>
        </div>
    );
};

export default CalculatorDate;

import {getItem} from "@/app/months/[id]/api";
import {Suspense} from "react";
import Content, {getMonth} from "@/app/months/[id]/Content";
import {setMeta} from "@/lib/meta";
import {Metadata} from "next";
import {myFont} from "@/utils/font";

type Props = {
    params: { id: string }
}

export async function generateMetadata(
    { params }: Props,
): Promise<Metadata> {
    // read route params
    const id = params.id

    // fetch data
    const [item] = await getItem(id);

    return {
        title: `Уставные чтения на месяц: ${getMonth(item?.value - 1)}`,
        description: `Список дней с уставными чтениями на месяц: ${getMonth(item?.value - 1)}`,
        openGraph: {
            type: "website",
            url: `//www.typikon.su/months/${id}`,
            title: `Уставные чтения на месяц: ${getMonth(item?.value - 1)}`,
            description: `Список дней с уставными чтениями на месяц: ${getMonth(item?.value - 1)}`,
        },
    }
}

const MonthPage = async ({ params: { id }}: { params: { id: string }}) => {
    const itemPromise = getItem(id);
    setMeta();

    return (
        <div className={myFont.variable}>
            <Suspense fallback={<div>Loading...</div>}>
                {/* @ts-expect-error Async Server Component */}
                <Content itemPromise={itemPromise} />
            </Suspense>
        </div>
    );
};

export default MonthPage;

import CommonMeta from "@/app/components/CommonMeta";
import {getItem} from "@/app/calendar/[id]/api";

interface IHead {
    params: { id: string; };
}

export default async function Head({ params: { id }}: IHead) {
    const [item] = await getItem(id);

    return (
        <>
            <CommonMeta />
            <title>Чтения на календарный день</title>
            <meta content="width=device-width, initial-scale=1" name="viewport" />
            <meta name="description" content="Уставные чтения на выбранный календарный день." />
            <meta property="og:type" content="website" />
            <meta property="og:title" content="Чтения на календарный день" />
            <meta property="og:url" content="//www.typikon.su/calendar/" />
            <meta property="og:description" content="Уставные чтения на выбранный календарный день." />
        </>
    )
}

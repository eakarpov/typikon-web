import {getItem} from "@/app/reading/[id]/api";
import CommonMeta from "@/app/components/CommonMeta";

interface IHead {
    params: { id: string; };
}

export default async function Head({ params: { id }}: IHead) {
    const [item] = await getItem(id);
    return (
        <>
            <CommonMeta />
            <title>{item?.start}</title>
            <meta content="width=device-width, initial-scale=1" name="viewport" />
            <meta name="description" content={`Уставные чтения на день: ${item?.start}`} />
            <meta property="og:type" content="website" />
            <meta property="og:title" content={item?.start} />
            <meta property="og:url" content={`//www.typikon.su/reading/${id}`} />
            <meta property="og:description" content={`Уставные чтения: ${item?.start}`} />
        </>
    )
}

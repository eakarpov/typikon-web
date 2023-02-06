import {getItem} from "@/app/penticostarion/[id]/api";
import CommonMeta from "@/app/components/CommonMeta";

interface IHead {
    params: { id: string };
}

export default async function Head({ params: { id }}: IHead) {
    const item = await getItem(id);
    return (
        <>
            <CommonMeta />
            <title>{item?.name}</title>
            <meta content="width=device-width, initial-scale=1" name="viewport" />
            <meta name="description" content={`Уставные чтения на день: ${item?.name}. ${item?.subnames?.join(',')}`} />
            <meta property="og:type" content="website" />
            <meta property="og:title" content={item?.name} />
            <meta property="og:url" content={`//www.typikon.su/penticostarion/${id}`} />
            <meta property="og:description" content={`Уставные чтения на день: ${item?.name}. ${item?.subnames?.join(',')}`} />
        </>
    )
}

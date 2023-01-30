import CommonMeta from "@/app/components/CommonMeta";
import {getItem} from "@/app/library/[id]/api";

interface IHead {
    params: { id: string };
}

export default async function Head({ params: { id }}: IHead) {
    const [item, err] = await getItem(id);
    return (
        <>
            <CommonMeta />
            <title>Библиотека текстов</title>
            <meta content="width=device-width, initial-scale=1" name="viewport" />
            <meta name="description" content={`Уставные чтения. ${item.author ? `Автор: (${item.author})` : ""}. Название: ${item.name}`} />
            <meta property="og:type" content="website" />
            <meta property="og:title" content={`${item.name} ${item.author ? `(${item.author})` : ""}`} />
            <meta property="og:url" content={`//www.typikon.su/library/${item.id}`} />
            <meta property="og:description" content={`Уставные чтения. ${item.author ? `Автор: (${item.author})` : ""}. Название: ${item.name}`} />
        </>
    )
}

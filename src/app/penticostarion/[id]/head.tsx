import {getItem} from "@/app/penticostarion/[id]/api";

interface IHead {
    params: { id: string };
}

export default async function Head({ params: { id }}: IHead) {
    const item = await getItem(id);
    return (
        <>
            <title>{item.name}</title>
            <meta content="width=device-width, initial-scale=1" name="viewport" />
            <meta name="description" content={`Чтения на день: ${item.name}. ${item.subnames?.join(',')}`} />
            <link rel="icon" href="/favicon.ico" />
        </>
    )
}

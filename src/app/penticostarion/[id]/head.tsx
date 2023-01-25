import {getItem} from "@/app/penticostarion/[id]/api";
import { analyticsConnector } from "@/utils/google";

interface IHead {
    params: { id: string };
}

export default async function Head({ params: { id }}: IHead) {
    const item = await getItem(id);
    return (
        <>
            <script async src="https://www.googletagmanager.com/gtag/js?id=G-5PZYF60JJ0"></script>
            <script>{analyticsConnector}</script>
            <title>{item.name}</title>
            <meta content="width=device-width, initial-scale=1" name="viewport" />
            <meta name="description" content={`Чтения на день: ${item.name}. ${item.subnames?.join(',')}`} />
            <link rel="icon" href="/favicon.ico" />
        </>
    )
}

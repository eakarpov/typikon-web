import Tabs from "@/app/admin/channel-posts/Tabs";
import { ChannelPostDTO } from "@/types/dto/channelPost";

const Content = async ({
    itemsPromise,
    archivePromise,
}: {
    itemsPromise: Promise<[ChannelPostDTO[] | null, any]>;
    archivePromise: Promise<[ChannelPostDTO[] | null, any]>;
}) => {
    const [items, error] = await itemsPromise;
    const [archive] = await archivePromise;

    if (error || !items) {
        return <div>Ошибка получения</div>;
    }

    return (
        <div className="flex flex-col gap-4 p-4">
            <p className="font-bold">Посты для Telegram/VK</p>
            <Tabs drafts={items} archive={archive || []} />
        </div>
    );
};

export default Content;

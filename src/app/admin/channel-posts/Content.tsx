import PostItem from "@/app/admin/channel-posts/PostItem";
import NewPostForm from "@/app/admin/channel-posts/NewPostForm";
import { ChannelPostDTO } from "@/types/dto/channelPost";

const Content = async ({ itemsPromise }: { itemsPromise: Promise<[ChannelPostDTO[] | null, any]> }) => {
    const [items, error] = await itemsPromise;

    if (error || !items) {
        return <div>Ошибка получения</div>;
    }

    return (
        <div className="flex flex-col gap-4 p-4">
            <p className="font-bold">Черновики постов для Telegram/VK — {items.length}</p>
            <NewPostForm />
            {items.length === 0 && (
                <p>
                    Пусто. Черновики появляются автоматически по крону
                    (см. <code>npm run channel-posts:generate</code>).
                </p>
            )}
            {items.map((item) => (
                <PostItem key={item.id} item={item} />
            ))}
        </div>
    );
};

export default Content;

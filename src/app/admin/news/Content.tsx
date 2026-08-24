import Manager from "@/app/admin/news/Manager";
import type { NewsPostDTO } from "@/types/dto/news";

const Content = async ({ itemsPromise }: { itemsPromise: Promise<[NewsPostDTO[] | null, any]> }) => {
    const [items, error] = await itemsPromise;

    if (error || !items) {
        return <div>Ошибка получения</div>;
    }

    return <Manager items={items} />;
};

export default Content;

import { Suspense } from "react";
import { hasAdminRights } from "@/lib/admin";
import { getItems } from "@/app/admin/news/api";
import Content from "@/app/admin/news/Content";

// Новости об обновлениях: заводятся здесь, читаются на /news, в RSS и в /api/v2/news.

const AdminNews = () => {
    const itemsData = getItems();

    return (
        <div className="flex flex-col">
            <Suspense fallback={<div>Loading...</div>}>
                <Content itemsPromise={itemsData} />
            </Suspense>
        </div>
    );
};

export default hasAdminRights(AdminNews);

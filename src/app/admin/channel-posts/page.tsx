import Content from "@/app/admin/channel-posts/Content";
import { Suspense } from "react";
import { getItems } from "@/app/admin/channel-posts/api";
import { hasAdminRights } from "@/lib/admin";

const AdminChannelPosts = () => {
    const itemsData = getItems();
    return (
        <div className="flex flex-col">
            <Suspense fallback={<div>Loading...</div>}>
                {/* @ts-expect-error Async Server Component */}
                <Content itemsPromise={itemsData} />
            </Suspense>
        </div>
    );
};

export default hasAdminRights(AdminChannelPosts);

import Content from "@/app/admin/channel-posts/Content";
import { Suspense } from "react";
import { getArchive, getItems } from "@/app/admin/channel-posts/api";
import { hasAdminRights } from "@/lib/admin";

const AdminChannelPosts = () => {
    const itemsData = getItems();
    const archiveData = getArchive();
    return (
        <div className="flex flex-col">
            <Suspense fallback={<div>Loading...</div>}>
                <Content itemsPromise={itemsData} archivePromise={archiveData} />
            </Suspense>
        </div>
    );
};

export default hasAdminRights(AdminChannelPosts);

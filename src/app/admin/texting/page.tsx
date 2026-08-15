import Content from "@/app/admin/texting/Content";
import {Suspense} from "react";
import {getItems} from "@/app/admin/texting/api";
import {hasAdminRights} from "@/lib/admin";

const AdminTexting = () => {
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

export default hasAdminRights(AdminTexting);

import Content from "@/app/admin/corrections/Content";
import {Suspense} from "react";
import {getItems} from "@/app/admin/corrections/api";
import {hasAdminRights} from "@/lib/admin";

const Admin = () => {
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

export default hasAdminRights(Admin);
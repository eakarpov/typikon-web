import Content from "@/app/admin/months/Content";
import {Suspense} from "react";
import {getItems} from "@/app/admin/months/api";
import {hasAdminRights} from "@/lib/admin";

const AdminWeeks = () => {
    const itemsData = getItems();

    return (
        <div className="flex flex-col">
            <p>
                Для добавления/удаления используем базу
            </p>
            <Suspense fallback={<div>Loading...</div>}>
                {/* @ts-expect-error Async Server Component */}
                <Content itemsPromise={itemsData} />
            </Suspense>
        </div>
    );
};

export default hasAdminRights(AdminWeeks);
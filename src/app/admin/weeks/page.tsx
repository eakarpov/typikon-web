import Content from "@/app/admin/weeks/Content";
import {Suspense} from "react";
import {getItems} from "@/app/admin/weeks/api";

const AdminWeeks = () => {
    if (!process.env.SHOW_ADMIN) {
        return null;
    }
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

export default AdminWeeks;
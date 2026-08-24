import { Suspense } from "react";
import { hasAdminRights } from "@/lib/admin";
import { getItems } from "@/app/admin/api-tokens/api";
import Content from "@/app/admin/api-tokens/Content";

// Ключи доступа к публичному API: кто ими пользуется, сколько тратит и кому сколько
// позволено. Пользователь заводит себе ключ сам в профиле; здесь — общий список,
// правка чисел и выпуск ключей приложению и партнёрам.

const AdminApiTokens = () => {
    const itemsData = getItems();

    return (
        <div className="flex flex-col">
            <Suspense fallback={<div>Loading...</div>}>
                <Content itemsPromise={itemsData} />
            </Suspense>
        </div>
    );
};

export default hasAdminRights(AdminApiTokens);

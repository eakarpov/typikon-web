import {cookies} from "next/headers";
import {decrypt} from "@/lib/authorize/sessions";
import {getItem} from "@/app/profile/api";
import Content from "@/app/admin/corrections/Content";
import {Suspense} from "react";
import {getItems} from "@/app/admin/corrections/api";

const Admin = async () => {
    const cookie = (await cookies()).get('session')?.value;
    const session = await decrypt(cookie);

    if (!session) {
        return (
            <div>
                Ошибка
            </div>
        );
    }

    const [item] = await getItem(session!.userId as string);

    if (!item) {
        return (
            <div>
                Пользователь не найден
            </div>
        )
    }
    if (!item.isAdmin) {
        return (
            <div>
                У вас нет прав для просмотра данной страницы
            </div>
        )
    }
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

export default Admin;
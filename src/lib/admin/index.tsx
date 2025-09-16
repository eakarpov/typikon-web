import {cookies} from "next/headers";
import {decrypt} from "@/lib/authorize/sessions";
import {getItem} from "@/app/profile/api";
import {FunctionComponent} from "react";

export const hasAdminRights = (Component: FunctionComponent) =>
    // eslint-disable-next-line react/display-name
    async () => {
    if (process.env.NODE_ENV === "development") {
        return <Component />;
    }

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
    console.log(item, Component);

    if (!item) {
        return (
            <div>
                Ошибка
            </div>
        )
    }

    if (!item.isAdmin) {
        return (
            <div>
                Нет доступа
            </div>
        );
    }

    return <Component />;
}
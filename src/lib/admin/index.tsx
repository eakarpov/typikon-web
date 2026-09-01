import {FunctionComponent} from "react";
import {type Capability} from "@/lib/rights";
import {viewer} from "@/lib/rights-server";

// Обёртка обобщена по пропсам страницы. Была объявлена на FunctionComponent
// без параметра, то есть на компонент БЕЗ пропсов, — и всякая админская
// страница, берущая params или searchParams, спотыкалась об это типом
// (десяток одинаковых ошибок в сборке). Поведение прежнее, шире только тип.
// ЗАКРЫВАЕТ ПО ВОЗМОЖНОСТИ, А НЕ ПО РОЛИ. Страница разбора заявок просит
// `parish.claims`, страница текстов — `content`: модератор приходов не должен
// получать доступ к разбору книг лишь потому, что он «тоже админ».
export const requires = <P extends object>(
    cap: Capability, Component: FunctionComponent<P>,
) =>
    // eslint-disable-next-line react/display-name
    async (props: P) => {
    if (process.env.NODE_ENV === "development") {
        return <Component  {...props} />;
    }
    if (!process.env.SHOW_ADMIN) {
        return null;
    }

    const { userId, caps } = await viewer();

    if (!userId) {
        return (
            <div>
                Войдите
            </div>
        );
    }

    if (!caps.has(cap)) {
        return (
            <div>
                Нет доступа
            </div>
        );
    }

    return <Component {...props} />;
}

/** Прежнее имя: разделы админки правят содержимое, и права им нужны те же. */
export const hasAdminRights = <P extends object>(Component: FunctionComponent<P>) =>
    requires("content", Component);
import {FunctionComponent} from "react";
import { userCan } from "@/lib/rights";

export const WithRights = ({
    Component,
    showButton,
    isDevelopment,
    user,
    session,
}: {
    Component: FunctionComponent;
    showButton: boolean;
    session: any|null
    isDevelopment: boolean;
    user?: any;
}) => {
        if (isDevelopment) {
            return <Component />;
        }

        if (!showButton) return null;

        if (!session) {
            return null;
        }

        if (!user) {
            return null;
        }

        // то же мерило, что и на сервере: возможность, а не роль. Здесь оно
        // только прячет кнопку — решает всё равно сервер
        if (!userCan(user, "content")) {
            return null;
        }

        return <Component />;
    }
import {FunctionComponent} from "react";

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

        if (!user.isAdmin) {
            return (
                <div>
                    Нет доступа
                </div>
            );
        }

        return <Component />;
    }
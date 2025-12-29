import {memo} from "react";
import {getItem} from "@/app/profile/api";
import SessionDispatcher from "@/app/SessionDispatcher";

const SessionChecker = async ({ session }: {
    session: any,
}) => {
    const sessionData = await session;

    let item;
    if (sessionData.isAuth) {
        [item] = await getItem(sessionData.userId as string);
    }

    return (
        <SessionDispatcher
            session={sessionData}
            user={item}
        />
    );
};

export default memo(SessionChecker);
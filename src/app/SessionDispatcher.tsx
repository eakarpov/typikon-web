'use client';
import {memo, useEffect} from "react";
import {AuthSlice} from "@/lib/store/auth";
import {useAppDispatch} from "@/lib/hooks";

const SessionChecker = async ({ session, user }: {
    session: any,
    user: any,
}) => {
    const dispatch = useAppDispatch();

    useEffect(() => {
        if (session) {
            dispatch(AuthSlice.actions.SetAuthorized({ ...session, user }));
        }
    }, [session, user]);

    console.log(session);
    return null;
};

export default memo(SessionChecker);
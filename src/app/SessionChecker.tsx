'use client';
import {memo, useCallback, useEffect} from "react";

const SessionChecker = ({ session }: {
    session: any,
}) => {
    console.log(session);
    return null;
};

export default memo(SessionChecker);
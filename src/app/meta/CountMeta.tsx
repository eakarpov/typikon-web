'use client';
import {memo, useEffect} from "react";
import { usePathname } from 'next/navigation';

const CountMeta = () => {
    const pathname = usePathname();

    useEffect(() => {
        fetch(`${window.location.protocol}//${window.location.host}/api/meta/log?source=${window.location.href}`);
    }, [pathname]);

    return null;
};

export default memo(CountMeta);

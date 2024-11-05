'use client';
import {memo, useEffect, useState} from "react";
import {usePathname} from "next/navigation";

interface IMeta {
    totalCount: number;
    totalUsers: number;
}

let controller = new AbortController();

const ContentMetaClient = () => {
    const pathname = usePathname();
    const [meta, setMeta] = useState<IMeta|null>(null);

    const abortFunction = () => {
        controller.abort();
    };

    useEffect(() => {
        let signal = controller.signal;
        fetch(`${window.location.protocol}//${window.location.host}/meta`, { // typikon-web-meta
            signal,
        })
            .then((res) => res.json())
            .then((data) => {
                setMeta(data);
            });
    }, [pathname]);

    useEffect(() => () => {
        abortFunction();
    }, [pathname]);

    if (!meta) return null;

    return (
        <div
            className="flex flex-col"
        >
            <span>
              Счетчик посещений:
            </span>
            <span>
              Количество посещений: {meta.totalCount}
            </span>
            <span>
              Количество посетителей: {meta.totalUsers}
            </span>
        </div>
    )
};

export default memo(ContentMetaClient);

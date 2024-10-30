'use client';

import {memo, useEffect, useState} from "react";
import {useRouter} from "next/navigation";
import { Router } from "next/router";

interface IMeta {
    totalCount: number;
    totalUsers: number;
}

let controller = new AbortController();

const ContentMetaClient = () => {
    const [meta, setMeta] = useState<IMeta|null>(null);

    const router = useRouter();

    console.log(router);

    const abortFunction = () => {
        controller.abort();
    };

    useEffect(() => {
        let signal = controller.signal;
        fetch(`${window.location.protocol}//${window.location.host}/api/meta/log`, {
            signal,
        })
            .then((res) => res.json())
            .then((data) => {
                if (data && data[0]) {
                    setMeta(data[0])
                }
            });
    }, []);

    useEffect(() => {
        Router.events.on("routeChangeStart", abortFunction);
        return () => {
            Router.events.off('routeChangeComplete', abortFunction);
        }
    }, [router]);

    if (!meta) return null;

    return (
        <div
            className="flex flex-col"
        >
            <span>
              Счетчик посещений (beta):
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

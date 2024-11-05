'use client';
import {memo, useEffect, useState} from "react";

interface IMeta {
    totalCount: number;
    totalUsers: number;
}

let controller;

const ContentMetaClient = () => {
    const [meta, setMeta] = useState<IMeta|null>(null);

    const abortFunction = () => {
        if (controller) {
            controller.abort();
        }
    };

    useEffect(() => {
        console.log('effecr');
        controller = new AbortController();
        fetch(`${window.location.protocol}//${window.location.host}/meta`, { // typikon-web-meta
            signal: controller.signal,
        })
            .then((res) => res.json())
            .then((data) => {
                setMeta(data);
            });
    }, []);

    useEffect(() => () => {
        abortFunction();
    }, []);

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

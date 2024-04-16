'use client';

import {memo, useEffect, useState} from "react";

interface IMeta {
    totalCount: number;
    totalUsers: number;
}

const ContentMetaClient = () => {
    const [meta, setMeta] = useState<IMeta|null>(null);

    useEffect(() => {
        fetch(`${window.location.protocol}//${window.location.host}/api/meta/log`)
            .then((res) => res.json())
            .then((data) => {
                if (data && data[0]) {
                    setMeta(data[0])
                }
            });
    }, []);

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

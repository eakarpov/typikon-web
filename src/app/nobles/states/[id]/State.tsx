'use client';

import {useMemo} from "react";
import Link from "next/link";

const State = ({ value }: { value: any }) => {
    const minDate = useMemo(() => {
        return value.rules.reduce((p: number|null, c: any) => {
            if (p === null) {
                if (c.startDate !== 0) {
                    return parseInt(c.startDate);
                }
                return p;
            }  else {
                return parseInt(c.startDate) < p ? parseInt(c.startDate) : p;
            }
        }, null);
    }, [value.rules]);

    const maxDate = useMemo(() => {
        return value.rules.reduce((p: number|null, c: any) => {
            if (p === null) {
                if (c.endDate !== 0) {
                    return parseInt(c.endDate);
                }
                return p;
            }  else {
                return parseInt(c.endDate) > p ? parseInt(c.endDate) : p;
            }
        }, null);
    }, [value.rules]);

    const sorted = useMemo(() => {
        if (!value.rules) return [];
        return value.rules.sort((a: any, b: any) => {
            if (parseInt(a.startDate) > parseInt(b.startDate)) {
                return 1;
            } else {
                return -1;
            }
        })
    }, [value.rules]);

    return (
        <div className="flex flex-row pr-4">
            <div className="flex flex-col pd-4">
                <span>
                    <b>Именование державности:</b> {value.data.name}
                </span>
                <span>
                    <b>Титул правителя:</b> {value.data.defaultTitle}
                </span>
                <span>
                    <b>Начало существования (по правлениям):</b> {minDate}
                </span>
                <span>
                    <b>Конец существования (по правлениям):</b> {maxDate}
                </span>
                <div className="flex flex-col pt-4">
                    <span><b>Державственность-наследник:</b> <Link href={`/nobles/states/${value.successor?.id}`}>
                        {value.successor?.name}</Link>
                    </span>
                    <span><b>Державственность-предшественник:</b> <Link href={`/nobles/states/${value.predessor?.id}`}>
                        {value.predessor?.name}</Link>
                    </span>
                </div>
                <div className="flex flex-col pt-4">
                    <span><b>Правления в период данной державности</b></span>
                    {sorted.map((item: any) => (
                        <div key={item.id}>
                        <span>
                            <Link href={`/nobles/${item.person.id}`}>
                                {item.person?.name}
                            </Link>{item.regentId ? (
                            <>
                                &nbsp;(регент - <Link href={`/nobles/${item.regentId}`}>{item.regent?.name}</Link>)
                            </>
                        ) : null} ({item.startDate} - {item.endDate})
                        </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default State;

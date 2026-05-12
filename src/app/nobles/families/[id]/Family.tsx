'use client';

import {useMemo} from "react";
import Link from "next/link";

const Family = ({ value }: { value: any }) => {
    const minDate = useMemo(() => {
        return value.persons.reduce((p: number|null, c: any) => {
            if (p === null) {
                if (c.birthDate !== 0) {
                    return parseInt(c.birthDate);
                }
                return p;
            }  else {
                return parseInt(c.birthDate) < p ? parseInt(c.birthDate) : p;
            }
        }, null);
    }, [value.persons]);

    const maxDate = useMemo(() => {
        return value.persons.reduce((p: number|null, c: any) => {
            if (p === null) {
                if (c.deathDate !== 0) {
                    return parseInt(c.deathDate);
                }
                return p;
            }  else {
                return parseInt(c.deathDate) > p ? parseInt(c.deathDate) : p;
            }
        }, null);
    }, [value.persons]);

    const sorted = useMemo(() => {
        if (!value.persons) return [];
        return value.persons.sort((a: any, b: any) => {
            if (parseInt(a.birthDate) > parseInt(b.birthDate)) {
                return 1;
            } else {
                return -1;
            }
        })
    }, [value.persons]);

    return (
        <div className="flex flex-row pr-4">
            <div className="flex flex-col pd-4">
                <span>
                    <b>Название рода:</b> {value.data.name}
                </span>
                <span>
                    <b>Начало существования (по членам рода):</b> {minDate}
                </span>
                <span>
                    <b>Конец существования (по членам рода):</b> {maxDate}
                </span>
                <div className="flex flex-col pt-4">
                    <span><b>Члены данного рода</b></span>
                    {sorted.map((item: any) => (
                        <div key={item.id}>
                        <span>
                            <Link href={`/nobles/${item.id}`}>
                                {item?.name}
                            </Link> ({item.birthDate} - {item.deathDate})
                        </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Family;

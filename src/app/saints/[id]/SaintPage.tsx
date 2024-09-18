'use client';
import React, {useCallback, useEffect, useMemo, useState} from "react";
import OSM from "ol/source/OSM";
import TileLayer from "ol/layer/Tile";
import Map from "ol/Map";
import View from "ol/View";
import {fromLonLat} from "ol/proj";
import Vector from "ol/source/Vector";
import {Point} from "ol/geom";
import Feature from "ol/Feature";
import {Heatmap} from "ol/layer";
import {DneslovKind} from "@/utils/texts";

enum COLLECTION_TYPE {
    BOOK,
    MENTION,
    AUTHOR,
}

// Доделать, когда Днеслов обновит айпи по айди
const SaintPage = ({ item, items, mentions }: {item: any, items: any[], mentions: any[] }) => {
    const authorItems = useMemo(() => items.filter(el => el.dneslovType === DneslovKind.AUTHOR), [items]);
    const bookItems = useMemo(() => items.filter(el => el.dneslovType !== DneslovKind.AUTHOR), [items]); // MEMORY

    const [collectionType, setCollectionType] = useState(COLLECTION_TYPE.BOOK);

    const collection = useMemo(() => {
        switch (collectionType) {
            case COLLECTION_TYPE.BOOK:
                return bookItems;
            case COLLECTION_TYPE.AUTHOR:
                return authorItems;
            case COLLECTION_TYPE.MENTION:
                return mentions;
            default:
                return [];
        }
    }, [collectionType, bookItems, authorItems, mentions]);

    const onPick = useCallback((picked: COLLECTION_TYPE) => () => {
        setCollectionType(picked);
    }, []);

    return (
        <>
            <div className="flex flex-col mb-2">
                Страниц памяти
            </div>
            <div className="flex flex-row">
                <div
                    className="pr-2 cursor-pointer"
                    onClick={onPick(COLLECTION_TYPE.BOOK)}
                    style={{ fontWeight: collectionType === COLLECTION_TYPE.BOOK ? 'bold' : 'normal' }}
                >
                    Тексты памяти
                </div>
                <div
                    className="pr-2 cursor-pointer"
                    onClick={onPick(COLLECTION_TYPE.MENTION)}
                    style={{ fontWeight: collectionType === COLLECTION_TYPE.MENTION ? 'bold' : 'normal' }}
                >
                    Тексты с упоминанием памяти
                </div>
                <div
                    className="pr-2 cursor-pointer"
                    onClick={onPick(COLLECTION_TYPE.AUTHOR)}
                    style={{ fontWeight: collectionType === COLLECTION_TYPE.AUTHOR ? 'bold' : 'normal' }}
                >
                    Тексты авторства святого
                </div>
            </div>
            <div className="mt-4">
                {collection.map((item) => (
                    <div className="font-serif" key={item._id}>
                        {item.name}
                    </div>
                ))}
            </div>
        </>
    );
}

export default SaintPage;

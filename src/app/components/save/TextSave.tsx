'use client';
import React, {memo, useCallback} from "react";
import {ArrowDownTrayIcon} from "@heroicons/react/24/outline";
// @ts-ignore
import { saveAs } from 'file-saver';
import {useAppSelector} from "@/lib/hooks";

const TextSave = ({ text, canDownloadPdf }: {text: any; canDownloadPdf?: string; }) => {
    const isAuthorized = useAppSelector(state => state.auth.isAuthorized);

    const onSave2 = useCallback(() => {
        fetch(`${window.location.protocol}//${window.location.host}/pdf`, { // typikon-web-pdf
            method: "POST",
            body: JSON.stringify(text),
            headers: {
              'Content-Type': 'application/json',
            },
        })
            .then((res) => res.blob())
            .then((res) => {
            const blob = new Blob([res], {type: "application/pdf"});
            const fileName = `${text.name}.pdf`;
            saveAs(blob, fileName);
        });
    }, [text]);

    if (canDownloadPdf !== "true" || !isAuthorized) {
        return null;
    }

    return (
        <span className="pr-4 text-amber-800 cursor-pointer flex flex-row items-center">
            <span onClick={onSave2}>
                Сохранить&nbsp;
            </span>
            <ArrowDownTrayIcon className="w-4 h-4" />
        </span>
    );
};

export default memo(TextSave);

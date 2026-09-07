'use client';
import React, {memo, useCallback} from "react";
import {ArrowDownTrayIcon} from "@heroicons/react/24/outline";
import {reportClientError} from "@/lib/reportClientError";
// import html2pdf from "html2pdf.js";

const TextSaveLocal = ({ name }: { name: string }) => {

    const onSave = useCallback(() => {
        const element = document.getElementById('text-reading-container')!;
        const clone = element.cloneNode(true) as HTMLElement;
        const items = clone.getElementsByClassName("no-pdf");
        [...items].forEach((element) => {
            (element as HTMLElement).style.display = "none";
        });
        const opt = {
            margin: [15,15] as [number, number],
            filename: `${name}.pdf`,
            image:        { type: 'jpeg' as const, quality: 0.98 },
            html2canvas:  { scale: 2, letterRendering: true },
            jsPDF:        { unit: 'pt', format: 'letter', orientation: 'portrait' as const },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        };
        import('html2pdf.js').then(html2pdf => {
            html2pdf.default().set(opt).from(clone).save();
        }).catch((e) => { reportClientError(e, "TextSaveLocal: html2pdf не загрузился"); })
        // html2pdf().set(opt).from(clone).save();
    }, []);

    return (
        <span className="pr-4 text-amber-800 cursor-pointer flex flex-row items-center">
            <span onClick={onSave}>
                Сохранить из браузера&nbsp;
            </span>
            <ArrowDownTrayIcon className="w-4 h-4" />
        </span>
    );
};

export default memo(TextSaveLocal);

'use client';
import React, {memo, useCallback} from "react";
import {ArrowDownTrayIcon} from "@heroicons/react/24/outline";
import html2pdf from "html2pdf.js";

const TextSaveLocal = ({ name }) => {

    const onSave = useCallback(() => {
        const element = document.getElementById('text-reading')!;
        const opt = {
            margin: [15,15],
            filename: `${name}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, letterRendering: true },
            jsPDF:        { unit: 'pt', format: 'letter', orientation: 'portrait' },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        };
        html2pdf().set(opt).from(element).save();
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

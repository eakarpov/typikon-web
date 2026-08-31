'use client';
import {memo, useEffect, useState} from "react";
import {UserCircleIcon, InformationCircleIcon} from "@heroicons/react/24/outline";
import {TextKind} from "@/utils/texts";

interface IDneslovImages {
    id: string;
    textType: TextKind;
    /**
     * Адрес кругляша из нашего каталога (saintRoundels). Когда он есть, в святцы не
     * ходим: этот компонент стоит в СПИСКЕ содержания книги, и без готового адреса
     * страница книги на полсотни текстов делала из браузера читателя полсотни
     * запросов к чужому серверу — по одному на строку.
     */
    roundelUrl?: string | null;
}

const cdnDneslovUrl = "https://cdn.dneslov.org";

const DneslovRoundImage = ({ id, textType, roundelUrl }: IDneslovImages) => {
    const [images, setImages] = useState<Array<{ url: string; roundelable_name: string; }>>(
        roundelUrl ? [{ url: roundelUrl, roundelable_name: "" }] : [],
    );

    useEffect(() => {
        if (roundelUrl) return;
        if (id) {
            // Пустой ответ — это «кругляша нет», а не сбой: святцы отвечают 204 без
            // тела, и голый res.json() ронял на нём необработанное обещание в консоль
            // читателя. Тот же случай, что и в снимке (см. scripts/lib/dneslov.ts).
            fetch(`https://dneslov.org/api/v1/roundels.json?m=${id}`)
                .then((res) => res.text())
                .then((body) => {
                    const parsed = body.trim() ? JSON.parse(body) : [];
                    setImages(Array.isArray(parsed) ? parsed : []);
                })
                .catch(() => setImages([]));
        }
    }, [id, roundelUrl]);

    if (!images.length) return (
        <div className="flex flex-col" style={{ paddingRight: '10px' }}>
            {textType === TextKind.HISTORIC ? (
                <UserCircleIcon className="text-stone-400" style={{ width: "32px", height: "32px"}} />
            ) : (
                <InformationCircleIcon className="text-stone-400" style={{ width: "32px", height: "32px"}} />
            )}
        </div>
    );

    return (
        <div className="flex flex-col" style={{ paddingRight: '10px' }}>
            <img
                src={images[0].url.includes("https") ? images[0].url : `${cdnDneslovUrl}${images[0].url}`}
                style={{ width: `30px`, height: '30px', maxWidth: 'fit-content' }}
                alt={images[0].roundelable_name}
            />
        </div>
    );
};

export default memo(DneslovRoundImage);

'use client';
import {memo, useEffect, useState} from "react";
import {UserCircleIcon, InformationCircleIcon} from "@heroicons/react/24/outline";
import {TextKind} from "@/utils/texts";

interface IDneslovImages {
    id: string;
    textType: TextKind;
}

const cdnDneslovUrl = "https://cdn.dneslov.org";

const DneslovRoundImage = ({ id, textType }: IDneslovImages) => {
    const [images, setImages] = useState<Array<{ url: string; roundelable_name: string; }>>([]);

    useEffect(() => {
        if (id) {
            fetch(`https://dneslov.org/api/v1/roundels.json?m=${id}`)
                .then((res) => res.json())
                .then((res) => {
                    setImages(res);
                });
        }
    }, [id]);

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

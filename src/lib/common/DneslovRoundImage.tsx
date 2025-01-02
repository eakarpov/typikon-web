'use client';
import {memo, useEffect, useState} from "react";

interface IDneslovImages {
    id: string;
}

const cdnDneslovUrl = "https://cdn.dneslov.org";

const DneslovRoundImage = ({ id }: IDneslovImages) => {
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

    if (!images.length) return null;

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

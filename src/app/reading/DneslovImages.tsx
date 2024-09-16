'use client';
import {memo, useEffect, useState} from "react";

interface IDneslovImages {
    dneslovId: string;
}

const DneslovImages = ({ dneslovId }: IDneslovImages) => {
    const [images, setImages] = useState([]);

    useEffect(() => {
        if (dneslovId) {
            fetch(`https://dneslov.org/api/v1/images.json?m=${dneslovId}`)
                .then((res) => res.json())
                .then((res) => {
                    setImages(res.map(e => e.thumb_url));
                });
        }
    }, [dneslovId]);

    if (!images.length) return null;

    return (
        <div className="flex flex-col pt-2" style={{ paddingLeft: '12px' }}>
            {images.map((image: string) => (
                <img
                    key={image}
                    src={image}
                    style={{ width: `300px`, height: 'auto' }}
                    alt={"Икона или картина, связанная с текстом"}
                />
            ))}
        </div>
    );
};

export default memo(DneslovImages);

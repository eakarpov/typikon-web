'use client';

import {memo} from "react";

const TextImages = ({ images }: { images: string[] }) => {
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
    )
};

export default memo(TextImages);

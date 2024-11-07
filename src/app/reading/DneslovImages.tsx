'use client';
import {memo, useEffect, useState} from "react";
import ImageGallery, {ReactImageGalleryItem} from "react-image-gallery";
import "react-image-gallery/styles/css/image-gallery.css";

interface IDneslovImages {
    dneslovId: string;
}

const DneslovImages = ({ dneslovId }: IDneslovImages) => {
    const [images, setImages] = useState<ReactImageGalleryItem[]>([]);

    useEffect(() => {
        if (dneslovId) {
            fetch(`https://dneslov.org/api/v1/images.json?m=${dneslovId}`)
                .then((res) => res.json())
                .then((res) => {
                    setImages(res.map(e => ({ thumbnail: e.thumb_url, original: e.url })));
                });
        }
    }, [dneslovId]);

    if (!images.length) return null;

    return (
        <div className="flex flex-col pt-2 w-full md:w-1/2" style={{ paddingLeft: '12px' }}>
            <ImageGallery
                items={images}
                lazyLoad
            />
        </div>
    );
};

export default memo(DneslovImages);

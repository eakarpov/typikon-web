'use client';
import {memo, useEffect, useState} from "react";
import ImageGallery, {ReactImageGalleryItem} from "react-image-gallery";
import "react-image-gallery/styles/css/image-gallery.css";

interface IDneslovImages {
    dneslovId: string;
    dneslovEventId?: string;
}

const cdnDneslovUrl = "https://cdn.dneslov.org";

const DneslovImages = ({ dneslovId, dneslovEventId }: IDneslovImages) => {
    const [images, setImages] = useState<ReactImageGalleryItem[]>([]);

    useEffect(() => {
        if (dneslovId) {
            fetch(`https://dneslov.org/api/v1/images.json?m=${dneslovId}${dneslovEventId ? `&e=${dneslovEventId}`: ""}`)
                .then((res) => res.json())
                .then((res) => {
                    setImages(res.map((e: { url: string; thumb_url: string; }) =>
                        ({
                            thumbnail: e.thumb_url.includes("https") ? e.thumb_url : `${cdnDneslovUrl}${e.thumb_url}`,
                            original: e.url.includes("https") ? e.url : `${cdnDneslovUrl}${e.url}`,})));
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

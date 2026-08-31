'use client';
import {memo, useEffect, useState} from "react";
import ImageGallery, {ReactImageGalleryItem} from "react-image-gallery";
import "react-image-gallery/styles/css/image-gallery.css";

interface IDneslovImages {
    dneslovId: string;
    dneslovEventId?: string;
    /**
     * Ссылки из нашего снимка (см. @/lib/saints, saintImages). Когда они есть — в
     * святцы не ходим вовсе: этот запрос уходил ИЗ БРАУЗЕРА ЧИТАТЕЛЯ на каждое
     * открытие чтения, то есть их доступность была доступностью картинок у читателя,
     * а их логи видели его адрес. undefined — памяти нет в каталоге, тогда старый путь.
     *
     * Сами файлы по-прежнему грузятся с их CDN: мы кэшируем адреса, а не изображения.
     */
    images?: { url: string; thumbUrl: string | null }[];
}

const cdnDneslovUrl = "https://cdn.dneslov.org";

const DneslovImages = ({ dneslovId, dneslovEventId, images: given }: IDneslovImages) => {
    const [images, setImages] = useState<ReactImageGalleryItem[]>(
        (given ?? []).map((e) => ({ thumbnail: e.thumbUrl ?? e.url, original: e.url })),
    );

    useEffect(() => {
        // Список пришёл с сервера — за ним никуда не идём.
        if (given) return;
        if (dneslovId) {
            // Пустое тело (204 «картинок нет») разбираем как пустой список, а не роняем.
            fetch(`https://dneslov.org/api/v1/images.json?m=${dneslovId}${dneslovEventId ? `&e=${dneslovEventId}`: ""}`)
                .then((res) => res.text())
                .then((body) => {
                    const res = body.trim() ? JSON.parse(body) : [];
                    setImages(res.map((e: { url: string; thumb_url: string; }) =>
                        ({
                            thumbnail: e.thumb_url.includes("https") ? e.thumb_url : `${cdnDneslovUrl}${e.thumb_url}`,
                            original: e.url.includes("https") ? e.url : `${cdnDneslovUrl}${e.url}`,})));
                })
                .catch(() => setImages([]));
        }
    }, [dneslovId, given]);

    if (!images.length) return null;

    return (
        <div className="flex flex-col pt-2 w-full md:w-1/2" style={{ paddingLeft: '12px', width: '300px' }}>
            <ImageGallery
                items={images}
                lazyLoad
            />
        </div>
    );
};

export default memo(DneslovImages);

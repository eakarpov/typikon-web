// Обёртка над внешним API dneslov.org — уже используется на сайте для получения
// иконы и канонического названия памяти святого (см. src/app/saints/[id]/api.ts,
// src/app/reading/DneslovImages.tsx). Используем тот же путь: dneslovId текста -> память -> фото/название.

interface DneslovMemo {
    title?: string;
    eventId?: string;
    description?: string;
}

interface DneslovMemory {
    slug?: string;
    memoes?: DneslovMemo[];
}

interface DneslovImage {
    url: string;
}

const MEMORY_URL = (id: string) => `https://dneslov.org/api/v0/memories/${id}.json`;
const IMAGES_URL = (id: string, eventId?: string | null) =>
    `https://dneslov.org/api/v1/images.json?m=${id}${eventId ? `&e=${eventId}` : ""}`;
const CDN = "https://cdn.dneslov.org";

const resolveUrl = (url: string) => (url.includes("https") ? url : `${CDN}${url}`);

export const getDneslovMemory = async (dneslovId?: string | null): Promise<DneslovMemory | null> => {
    if (!dneslovId) return null;
    try {
        const memoryRes = await fetch(MEMORY_URL(dneslovId));
        if (!memoryRes.ok) return null;
        const memory = await memoryRes.json();
        if (!memory?.slug) return null;

        const detailsRes = await fetch(`https://dneslov.org/${memory.slug}.json`);
        if (!detailsRes.ok) return null;
        return await detailsRes.json();
    } catch (e) {
        console.error("dneslov: не удалось получить память", e);
        return null;
    }
};

export const getDneslovImage = async (
    dneslovId?: string | null,
    dneslovEventId?: string | null,
): Promise<string | null> => {
    if (!dneslovId) return null;
    try {
        const res = await fetch(IMAGES_URL(dneslovId, dneslovEventId));
        if (!res.ok) return null;
        const images: DneslovImage[] = await res.json();
        if (!images?.length) return null;
        return resolveUrl(images[0].url);
    } catch (e) {
        console.error("dneslov: не удалось получить фото", e);
        return null;
    }
};

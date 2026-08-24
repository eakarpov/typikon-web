import {CacheTag, CacheTagValue} from "@/lib/cache";

// Вызывается из редакторов админки после сохранения: страницы и выборки
// кэшируются, без сброса тегов правка появилась бы на сайте только по таймауту.
export const revalidateTags = (tags: CacheTagValue[]) =>
    fetch("/api/revalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags }),
    }).catch((e) => {
        console.error(e);
    });

export const revalidateTexts = () => revalidateTags([CacheTag.TEXTS]);
export const revalidateDays = () => revalidateTags([CacheTag.DAYS]);

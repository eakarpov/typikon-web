import {CacheTag, CacheTagValue} from "@/lib/cache";
import {reportError} from "@/lib/reportError";

// Вызывается из редакторов админки после сохранения: страницы и выборки
// кэшируются, без сброса тегов правка появилась бы на сайте только по таймауту.
export const revalidateTags = (tags: CacheTagValue[]) =>
    fetch("/api/revalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags }),
    }).catch((e) => {
        reportError(e, { where: "lib/admin/revalidate#revalidateTags" });
    });

export const revalidateTexts = () => revalidateTags([CacheTag.TEXTS]);
export const revalidateDays = () => revalidateTags([CacheTag.DAYS]);

// Библия правится не редактором текста, а редактором издания, поэтому и тег у неё свой.
export const revalidateBible = () => revalidateTags([CacheTag.BIBLE]);

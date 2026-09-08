import { fail, preflight, respondCollection } from "@/lib/api/v2/http";
import { authorize } from "@/lib/api/v2/access";
import { readPage } from "@/lib/api/v2/params";
import { allNames } from "@/lib/imeniny/store";
import { nameKey } from "@/lib/imeniny/core";
import { reportError } from "@/lib/reportError";

// Указатель имён: по какому имени в святцах есть кого поминать.
//
// Раздел доступа — «calendar»: именины это память дня, а не текст собрания.
//
// Указатель строится скриптом (npm run names:index), а не сайтом: разбор
// заголовков святцев — наш вывод, и смотреть его надо отчётом прежде, чем
// показывать читателю. Ручка поэтому только читает.
export const revalidate = 86400;

export async function OPTIONS() {
    return preflight();
}

export async function GET(request: Request) {
    const access = await authorize(request, "calendar");
    if (access.denied) return access.denied;

    const url = new URL(request.url);
    const { limit, offset } = readPage(url);

    // Отбор по началу имени, а не по вхождению: указатель листают, чтобы найти
    // своё имя, и «на Ан…» — обычный способ его искать. Ключ нормализуется тем
    // же nameKey, что и сами записи, иначе «Иоаннъ» не нашёл бы «иоанн».
    const prefix = nameKey(url.searchParams.get("q") ?? "");

    try {
        const all = await allNames();
        const found = prefix ? all.filter(item => item.key.startsWith(prefix)) : all;

        return respondCollection(
            found.slice(offset, offset + limit),
            { total: found.length, limit, offset },
            { access, maxAge: revalidate },
        );
    } catch (e) {
        reportError(e, { where: "app/api/v2/imeniny/route#GET", source: "api" });
        return fail("internal", "Не удалось получить указатель имён");
    }
}

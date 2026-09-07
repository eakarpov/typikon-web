import { preflight, respondCollection } from "@/lib/api/v2/http";
import { authorize } from "@/lib/api/v2/access";
import { bibleBookList } from "@/utils/bibleBooks";

// Оглавление Библии: какие книги вообще можно подставить в /api/v2/bible/{книга}/{глава}.
//
// Область доступа — «texts», как у изданий и главы: это тот же раздел, и заводить
// внешнему клиенту второй ключ ради списка книг незачем.
//
// Список отдаётся ЦЕЛИКОМ, без постраничности, и это решение, а не упущение. Он
// закрыт (77 книг канона плюс приложение) и лежит в коде, а не в базе; постранично
// же отданное оглавление клиент был бы обязан сшивать из страниц, чтобы показать
// первый экран. Поля limit/offset в конверте остаются ради общей формы коллекций —
// клиенту не придётся разбирать этот ответ иначе, чем все прочие.
//
// Сутки в revalidate — не осторожность: список меняется только вместе с выкладкой
// кода, так что чаще спрашивать нечего.
export const revalidate = 86400;

export async function OPTIONS() {
    return preflight();
}

export async function GET(request: Request) {
    const access = await authorize(request, "texts");
    if (access.denied) return access.denied;

    // Ни базы, ни файлов: падать здесь нечему, поэтому и обёртки try/catch нет.
    const items = bibleBookList();

    return respondCollection(
        items,
        { total: items.length, limit: items.length, offset: 0 },
        { access, maxAge: revalidate },
    );
}

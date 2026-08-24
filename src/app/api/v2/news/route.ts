import { fail, preflight, respondCollection } from "@/lib/api/v2/http";
import { authorize } from "@/lib/api/v2/access";
import { readPage } from "@/lib/api/v2/params";
import { listPublished } from "@/lib/news/posts";
import { newsItem } from "@/lib/api/v2/serialize";

// Новости сайта наружу: приложение показывает «что нового» тем же списком, что и сайт,
// а не своим, который пришлось бы обновлять вместе с выпуском.
export const revalidate = 600;

export async function OPTIONS() {
    return preflight();
}

export async function GET(request: Request) {
    const access = await authorize(request, "news");
    if (access.denied) return access.denied;

    const { limit, offset } = readPage(new URL(request.url));

    try {
        const [items, total] = await listPublished(limit, offset);

        // Десять минут: новость выходит раз в недели, но узнать о ней хочется в тот же день.
        return respondCollection(items.map(newsItem), { total, limit, offset }, { maxAge: 600, access });
    } catch (e) {
        console.error(e);
        return fail("internal", "Не удалось получить новости");
    }
}

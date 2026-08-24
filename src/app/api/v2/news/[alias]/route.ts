import { fail, preflight, respond } from "@/lib/api/v2/http";
import { authorize } from "@/lib/api/v2/access";
import { getPublished } from "@/lib/news/posts";
import { newsItem } from "@/lib/api/v2/serialize";

export const revalidate = 600;

export async function OPTIONS() {
    return preflight();
}

export async function GET(request: Request, { params }: { params: { alias: string } }) {
    const access = await authorize(request, "news");
    if (access.denied) return access.denied;

    try {
        const post = await getPublished(params.alias);

        if (!post) return fail("not_found", `Новость «${params.alias}» не найдена`);

        return respond(newsItem(post), { maxAge: 600, access });
    } catch (e) {
        console.error(e);
        return fail("internal", "Не удалось получить новость");
    }
}

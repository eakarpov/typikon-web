import {NextRequest, NextResponse} from "next/server";
import {revalidateTag} from "next/cache";
import {cookies} from "next/headers";
import {decrypt} from "@/lib/authorize/sessions";
import {getItem} from "@/app/profile/api";
import {CacheTag} from "@/lib/cache";

// Сбрасывает кэш выборок после правки контента в админке. Вызывается из редакторов
// (см. src/lib/admin/revalidate.ts): API админки живёт в pages-роутере, а
// revalidateTag работает только в app-роутере, поэтому это отдельная ручка.

const ALLOWED_TAGS: string[] = Object.values(CacheTag);

const isAdmin = async () => {
    if (process.env.NODE_ENV === "development") return true;

    const cookie = (await cookies()).get("session")?.value;
    const session = await decrypt(cookie);

    if (!session?.userId) return false;

    const [user] = await getItem(session.userId as string);

    return Boolean(user?.isAdmin);
};

export async function POST(request: NextRequest) {
    if (!(await isAdmin())) {
        return new NextResponse(null, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    const tags: string[] = Array.isArray(body?.tags) ? body.tags : [];
    const known = tags.filter((tag) => ALLOWED_TAGS.includes(tag));

    if (!known.length) {
        return NextResponse.json({ error: "Не переданы известные теги" }, { status: 400 });
    }

    known.forEach((tag) => revalidateTag(tag));

    return NextResponse.json({ revalidated: known });
}

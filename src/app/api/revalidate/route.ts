import {NextRequest, NextResponse} from "next/server";
import {revalidateTag} from "next/cache";
import {cookies} from "next/headers";
import {decrypt} from "@/lib/authorize/sessions";
import {getItem} from "@/app/profile/api";
import {CacheTag} from "@/lib/cache";
import {can} from "@/lib/rights-server";

// Сбрасывает кэш выборок после правки контента. Вызывается из двух мест:
//   * редакторы админки (src/lib/admin/revalidate.ts) — по сессии администратора;
//   * скрипты миграции данных (src/scripts/lib/revalidate.ts) — по токену.
//
// Отдельная ручка нужна потому, что API админки живёт в pages-роутере, а revalidateTag
// работает только в app-роутере. Скриптам же сессия недоступна в принципе: они правят
// базу мимо приложения, и без этого вызова сайт до часа отдаёт старое из кэша выборок.

const ALLOWED_TAGS: string[] = Object.values(CacheTag);

const isAdmin = async () => {
    if (process.env.NODE_ENV === "development") return true;
    // сброс кэша — часть правки содержимого, и права ему нужны те же
    return can("content");
};

// Токен для скриптов. Пока REVALIDATE_TOKEN не задан в окружении, этот путь закрыт
// полностью — не хватает переменной, а не «пустой токен подходит».
const hasValidToken = (request: NextRequest) => {
    const expected = process.env.REVALIDATE_TOKEN;
    if (!expected) return false;

    const provided = request.headers.get("x-revalidate-token");
    if (!provided || provided.length !== expected.length) return false;

    // Сравнение без раннего выхода: на длине токена это мелочь, но и стоит она мелочь.
    let diff = 0;
    for (let i = 0; i < expected.length; i++) {
        diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
    }
    return diff === 0;
};

export async function POST(request: NextRequest) {
    if (!hasValidToken(request) && !(await isAdmin())) {
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

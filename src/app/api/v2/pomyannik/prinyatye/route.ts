import { authorizeUser } from "@/lib/api/v2/user";
import { fail, respondPrivate } from "@/lib/api/v2/http";
import { readPage } from "@/lib/api/v2/params";
import { zapiska as serializeNote } from "@/lib/api/v2/serialize";
import { commemoratorOf } from "@/lib/pomyannik/commemorators";
import { countUnread, notesFor } from "@/lib/pomyannik/zapiski";
import { reportError } from "@/lib/reportError";

// ПОДАННЫЕ ЗАПИСКИ — сторона священника.
//
// Неразобранные сверху: за ними и приходят. Порядок задаёт `notesFor`
// (`readAt: 1, createdAt: -1`), и пересортировывать его на клиенте не надо —
// пустое `readAt` Mongo кладёт первым нарочно.
//
// `fromUserId` наружу не идёт: кто подал, читающему не нужно, а это личность
// третьего лица. Стёртая по сроку записка приходит с пустыми именами и
// непустым `namesCount` — «было столько-то» переживает чистку.
//
// Не открывшему приём — `forbidden`, а не пустой список: пустой означал бы «вам
// никто не подавал», а правды в этом нет.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const access = await authorizeUser(request, "pomyannik");
    if (access.denied) return access.denied;

    const { limit, offset } = readPage(new URL(request.url));

    try {
        const commemorator = await commemoratorOf(access.userId);
        if (!commemorator) {
            return fail("forbidden", "Приём записок вам пока не открыт");
        }

        const [notes, unread] = await Promise.all([
            notesFor(access.userId),
            countUnread(access.userId),
        ]);

        return respondPrivate({
            items: notes.slice(offset, offset + limit).map(serializeNote),
            total: notes.length,
            limit,
            offset,
            unread,
            commemorator: { title: commemorator.title, place: commemorator.place ?? null },
        }, { access });
    } catch (e) {
        reportError(e, { where: "app/api/v2/pomyannik/prinyatye/route#GET", source: "api" });
        return fail("internal", "Не удалось открыть поданные записки");
    }
}

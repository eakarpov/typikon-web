import { fail, preflight, respond } from "@/lib/api/v2/http";
import { authorize } from "@/lib/api/v2/access";
import { getItem } from "@/app/calendar/[id]/api";
import { dayDetail } from "@/lib/api/v2/serialize";
import { DAY_SLOT_ORDER, TextType, valueTitle } from "@/utils/texts";
import { readLang } from "@/lib/api/v2/calendar";

// День церковного года по его постоянному адресу (march-30, post-1-sb, pascha).
// В отличие от /calendar/{дата} здесь не считается подвижный круг — берётся
// именно тот день, который запрошен.
export const revalidate = 3600;

export async function OPTIONS() {
    return preflight();
}

export async function GET(request: Request, { params }: { params: { alias: string } }) {
    const access = await authorize(request, "calendar");
    if (access.denied) return access.denied;

    try {
        const [day, error] = await getItem(params.alias, readLang(new URL(request.url)));

        if (error) return fail("internal", "Не удалось получить день");
        if (!day) return fail("not_found", `День «${params.alias}» не найден`);

        return respond(dayDetail(day, DAY_SLOT_ORDER as readonly string[], (slot) => valueTitle(slot as TextType)), { access });
    } catch (e) {
        console.error(e);
        return fail("internal", "Не удалось получить день");
    }
}

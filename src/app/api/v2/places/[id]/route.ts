import { fail, preflight, respond } from "@/lib/api/v2/http";
import { authorize } from "@/lib/api/v2/access";
import { getItem } from "@/app/places/[id]/api";
import { placeDetail } from "@/lib/api/v2/serialize";
import { reportError } from "@/lib/reportError";

// МЕСТО, помеченное в тексте географическим именем.
//
// Спрашивается и по идентификатору, и по псевдониму — как тексты и книги: в
// разметке текста стоит то одно, то другое.
export const revalidate = 3600;

export async function OPTIONS() {
    return preflight();
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const access = await authorize(request, "texts");
    if (access.denied) return access.denied;

    const { id } = await params;

    try {
        const [place, error] = await getItem(id);
        if (error) return fail("internal", "Не удалось получить место");
        if (!place) return fail("not_found", "Такого места нет");

        return respond(placeDetail(place), { access });
    } catch (e) {
        reportError(e, { where: "app/api/v2/places/[id]/route#GET", source: "api" });
        return fail("internal", "Не удалось получить место");
    }
}

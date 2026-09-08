import { ObjectId } from "mongodb";

import { fail, preflight, respond } from "@/lib/api/v2/http";
import { authorize } from "@/lib/api/v2/access";
import { getItem } from "@/app/dictionary/[id]/api";
import { lexemeDetail } from "@/lib/api/v2/serialize";
import { reportError } from "@/lib/reportError";

// Словарная статья с парадигмой.
//
// Парадигма отдаётся плоским списком ячеек, а не сеткой под вёрстку: имена
// ячеек — грамматические адреса («sgNom», «aorPl3», «partPastPass»), и по ним
// клиент разложит таблицу как ему удобно. Порядок ячеек наш и осмысленный, так
// что идущему подряд достаточно его же.
//
// У всякой формы стоит `stored`: выписана она в словаре или порождена по
// таблице склонения. Разница здесь ровно та же, что между заявленным и
// предположенным у зачинов, — факт и вывод, — и схлопывать её нельзя.
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
    if (!ObjectId.isValid(id)) return fail("bad_request", "Неверный идентификатор слова");

    try {
        const [item, error] = await getItem(id);
        if (error) return fail("internal", "Не удалось собрать словарную статью");
        if (!item) return fail("not_found", "Такого слова в словаре нет");

        return respond(lexemeDetail(item), { access, maxAge: revalidate });
    } catch (e) {
        reportError(e, { where: "app/api/v2/dictionary/[id]/route#GET", source: "api" });
        return fail("internal", "Не удалось собрать словарную статью");
    }
}

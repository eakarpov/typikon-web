import { authorize } from "@/lib/api/v2/access";
import { fail, preflight, respond } from "@/lib/api/v2/http";
import { chantDetail } from "@/lib/api/v2/serialize";
import { getChant } from "@/lib/chants";
import { reportError } from "@/lib/reportError";

// ПЕСНОПЕНИЕ ЦЕЛИКОМ — по тому самому идентификатору, который указатель зачинов
// отдаёт полем `sampleId` и в своём же описании обещает: «чтобы за ним можно
// было сходить в /api/v2/chants». Сходить было некуда: та ручка принимает
// запрос, а не идентификатор, и всякое вхождение зачина оставалось без текста.
//
// Раздел доступа `texts`, а не `search`. Полнотекстового запроса здесь нет
// вовсе — это чтение одной строки по ключу, и закрывать его ключом значило бы
// закрыть чтение того, что и так под CC BY.
export const revalidate = 3600;

export async function OPTIONS() {
    return preflight();
}

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
    const access = await authorize(request, "texts");
    if (access.denied) return access.denied;

    const { id } = await ctx.params;
    const number = Number(id);
    if (!Number.isInteger(number) || number <= 0) {
        return fail("bad_request", "Идентификатор строки — целое число");
    }

    try {
        const chant = getChant(number);
        // `null` здесь значит и «корпуса нет», и «такой строки нет», и различить
        // их изнутри `getChant` нечем. Для спрашивающего про одну строку верен
        // один ответ — `not_found`; про отсутствие корпуса прямо отвечает
        // ручка-список, как и у зачинов.
        if (!chant) return fail("not_found", "Такого песнопения в корпусе нет");

        return respond(chantDetail(chant), { access, maxAge: revalidate });
    } catch (e) {
        reportError(e, { where: "app/api/v2/chants/[id]/route#GET", source: "api" });
        return fail("internal", "Не удалось открыть песнопение");
    }
}

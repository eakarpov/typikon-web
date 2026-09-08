import { authorizeUser } from "@/lib/api/v2/user";
import { fail, respondPrivate } from "@/lib/api/v2/http";
import { markNote } from "@/lib/pomyannik/zapiski";
import { reportError } from "@/lib/reportError";

// ОТМЕТКА: прочитана, поминовение окончено.
//
// Одно нажатие на то и другое: священник у аналоя, а не за столом, и трёх
// нажатий на записку у него нет.
//
// Принимающий — в фильтре запроса: отметить чужую записку нельзя даже по
// угаданному идентификатору. Прочтение обратно не снимается — «я это уже читал»
// не то, о чём стоит передумывать.
//
// 404 и «уже отмечено» здесь неразличимы НАРОЧНО: по ответу нельзя узнать,
// существует ли чужая записка. Улучшать это нельзя.
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
    const access = await authorizeUser(request, "pomyannik");
    if (access.denied) return access.denied;

    const { id } = await ctx.params;
    const body = await request.json().catch(() => null);
    const mark = (body as any)?.mark;

    if (mark !== "read" && mark !== "finished") {
        return fail("bad_request", "Отметить можно «read» или «finished»");
    }

    try {
        const marked = await markNote(access.userId, id, mark);
        if (!marked) return fail("not_found", "Такой записки нет или она уже отмечена");

        return respondPrivate({ ok: true }, { access });
    } catch (e) {
        reportError(e, { where: "app/api/v2/pomyannik/prinyatye/[id]/route#PATCH", source: "api" });
        return fail("internal", "Не удалось отметить записку");
    }
}

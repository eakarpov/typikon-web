import { authorizeUser } from "@/lib/api/v2/user";
import { fail, respondPrivate } from "@/lib/api/v2/http";
import { pomyannikPerson } from "@/lib/api/v2/serialize";
import { deletePerson, getPerson, updatePerson } from "@/lib/pomyannik/service";
import type { PersonInput } from "@/lib/pomyannik/types";
import { memorialDays, sorokoustSpan, todayIso } from "@/lib/pomyannik/reckoning";
import { reportError } from "@/lib/reportError";

// ЛИЦО И СЧЁТ ПО НЕМУ.
//
// Счёт приезжает вместе с лицом, а не считается клиентом. Правило «день
// преставления считается первым» даёт третий день через двое суток, девятый
// через восемь, сороковой через тридцать девять, и всякая попытка повторить это
// на той стороне ошибётся на день — ровно в ту сторону, где день пропускают.
//
// `on` — день, на который посчитано. Без него полежавший в кэше ответ молча
// неверен: `newlyDeparted` живёт сорок дней и сам собою протухает, а число лет
// прибавляется в годовщину. Клиент обязан сверить `on` с сегодняшним числом и
// перезапросить, если карточка пролежала открытой через полночь.
export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
    const access = await authorizeUser(request, "pomyannik");
    if (access.denied) return access.denied;

    const { id } = await ctx.params;

    try {
        const person = await getPerson(access.userId, id);
        // Чужое лицо — тоже `not_found`, и различать эти два случая нельзя: ответ
        // не должен подтверждать, что запись существует.
        if (!person) return fail("not_found", "Такого имени в вашем помяннике нет");

        const on = todayIso();

        return respondPrivate({
            on,
            person: pomyannikPerson(person),
            memorial: person.died ? memorialDays(person.died, on) : null,
            // Сорокоуст — НЕ сороковой день: он считается со дня заказа, а не со
            // дня кончины, и заказанный на девятый день кончится на сорок восьмой.
            sorokoust: person.sorokoust ? sorokoustSpan(person.sorokoust.from, on) : null,
        }, { access });
    } catch (e) {
        reportError(e, { where: "app/api/v2/pomyannik/persons/[id]/route#GET", source: "api" });
        return fail("internal", "Не удалось открыть запись");
    }
}

/**
 * Правка приходит ЦЕЛЫМ ЛИЦОМ, а не по полю.
 *
 * Иначе пришлось бы решать, что значит отсутствующее поле — «не трогай» или
 * «сотри», — и на этом вопросе рано или поздно кто-нибудь потеряет дату
 * преставления. Правило не наше, оно уже стоит в `service.updatePerson`; здесь
 * оно только не нарушается.
 */
export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
    const access = await authorizeUser(request, "pomyannik");
    if (access.denied) return access.denied;

    const { id } = await ctx.params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
        return fail("bad_request", "Не разобрали тело запроса");
    }

    try {
        const person = await updatePerson(access.userId, id, body as PersonInput);
        if (!person) return fail("not_found", "Такого имени в вашем помяннике нет");

        return respondPrivate({ person: pomyannikPerson(person) }, { access });
    } catch (e) {
        reportError(e, { where: "app/api/v2/pomyannik/persons/[id]/route#PUT", source: "api" });
        return fail("internal", "Не удалось поправить запись");
    }
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
    const access = await authorizeUser(request, "pomyannik");
    if (access.denied) return access.denied;

    const { id } = await ctx.params;

    try {
        const deleted = await deletePerson(access.userId, id);
        if (!deleted) return fail("not_found", "Такого имени в вашем помяннике нет");

        return respondPrivate({ deleted: true }, { access });
    } catch (e) {
        reportError(e, { where: "app/api/v2/pomyannik/persons/[id]/route#DELETE", source: "api" });
        return fail("internal", "Не удалось убрать запись");
    }
}

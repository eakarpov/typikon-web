import { authorizeUser } from "@/lib/api/v2/user";
import { fail, respondPrivate, respondPrivateCollection } from "@/lib/api/v2/http";
import { readEnum, readPage } from "@/lib/api/v2/params";
import { pomyannikPerson } from "@/lib/api/v2/serialize";
import { addPersons, listPersons, TooManyPersonsError } from "@/lib/pomyannik/service";
import { MAX_BATCH } from "@/lib/pomyannik/types";
import type { PersonInput } from "@/lib/pomyannik/types";
import { reportError } from "@/lib/reportError";

// ПОМЯННИК ЦЕЛИКОМ.
//
// Личное: и тело, и самый факт запроса. Отсюда `force-dynamic` и никакого
// `revalidate` — строка `export const revalidate = 3600`, списанная с досье
// святого, положила бы список одного человека в кэш под адресом, одинаковым для
// всех остальных.
//
// Хозяин уходит в ФИЛЬТР запроса, а не в проверку после (см. lib/pomyannik/
// service): чужую запись нельзя ни прочесть, ни поправить даже по угаданному
// идентификатору.
//
// Отбор по разделу — не удобство: помянник тем и устроен, что развороты разные,
// и «о здравии» с «о упокоении» листают порознь.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const access = await authorizeUser(request, "pomyannik");
    if (access.denied) return access.denied;

    const url = new URL(request.url);
    const { limit, offset } = readPage(url);
    const kind = readEnum(url, "kind", ["living", "departed"]);

    try {
        const all = await listPersons(access.userId);
        const found = kind ? all.filter(person => person.kind === kind) : all;

        // Режем здесь, а не в `listPersons`: пятьсот имён — потолок помянника, и
        // тащить страницы в общий с сайтом слой ради этого незачем.
        return respondPrivateCollection(
            found.slice(offset, offset + limit).map(pomyannikPerson),
            { total: found.length, limit, offset },
            { access },
        );
    } catch (e) {
        reportError(e, { where: "app/api/v2/pomyannik/persons/route#GET", source: "api" });
        return fail("internal", "Не удалось открыть помянник");
    }
}

/**
 * Записать имена — одно или пачкой.
 *
 * Тело принимается в двух видах: одно лицо объектом или несколько в `persons`.
 * Голый массив в корне, какой берёт ручка сайта, здесь не принимаем: в v2 у
 * ответов и запросов конверт, и коллекция в корне выбивалась бы из него одна.
 *
 * Повторов не отсеиваем — двух Николаев в роду не редкость, и молча слить их
 * значило бы решить за человека, что один из них лишний.
 */
export async function POST(request: Request) {
    const access = await authorizeUser(request, "pomyannik");
    if (access.denied) return access.denied;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
        return fail("bad_request", "Не разобрали тело запроса");
    }

    const inputs: PersonInput[] = Array.isArray((body as any).persons)
        ? (body as any).persons
        : [body as PersonInput];

    if (inputs.length > MAX_BATCH) {
        return fail("bad_request", `За раз принимается не больше ${MAX_BATCH} имён`);
    }

    try {
        const created = await addPersons(access.userId, inputs);
        // Имени в присланном не нашлось: `clean` отбрасывает строки без имени, и
        // пустой ответ здесь значил бы «записали», ничего не записав.
        if (!created.length) return fail("bad_request", "Имени в присланном не нашлось");

        return respondPrivate({ items: created.map(pomyannikPerson) }, { access, status: 201 });
    } catch (e) {
        if (e instanceof TooManyPersonsError) return fail("conflict", e.message);
        reportError(e, { where: "app/api/v2/pomyannik/persons/route#POST", source: "api" });
        return fail("internal", "Не удалось записать имя");
    }
}

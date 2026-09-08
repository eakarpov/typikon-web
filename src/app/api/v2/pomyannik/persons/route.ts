import { authorizeUser } from "@/lib/api/v2/user";
import { fail, respondPrivateCollection } from "@/lib/api/v2/http";
import { readEnum, readPage } from "@/lib/api/v2/params";
import { pomyannikPerson } from "@/lib/api/v2/serialize";
import { listPersons } from "@/lib/pomyannik/service";
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

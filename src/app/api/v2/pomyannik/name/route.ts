import { authorizeUser } from "@/lib/api/v2/user";
import { fail, respondPrivate } from "@/lib/api/v2/http";
import { allNames } from "@/lib/imeniny/store";
import { checkName } from "@/lib/pomyannik/names";
import { slavonicName } from "@/lib/pomyannik/slavonic";
import { reportError } from "@/lib/reportError";

// СВЕРКА ОДНОГО ИМЕНИ — прежде чем оно ляжет в помянник.
//
// Помянник хранит СЛОВАРНУЮ ФОРМУ, и от неё зависят три вещи: память в святцах,
// сверка наречения и склонение для записки. Написанное косвенным падежом — «о
// здравии Анны», как помянник и читают вслух, — молча отказывает во всех трёх:
// «Анны» в указателе нет, есть «Анна».
//
// Оттого сверка и показывается ДО записи. Подсказка при этом не применяется
// сама: «Иоанна» — и родительный от «Иоанна», и самостоятельное женское имя, а
// имя наречения вообще дело крещения, а не словаря.
//
// Личного в ответе нет, но вход нужен: спрашивают её из помянника, а открытый
// словарь имён у нас и так есть на /imeniny.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const access = await authorizeUser(request, "pomyannik");
    if (access.denied) return access.denied;

    const query = new URL(request.url).searchParams.get("q") ?? "";
    if (!query.trim()) return fail("bad_request", "Нечего сверять");

    try {
        const names = await allNames();
        const check = checkName(query, names.map(n => n.key));
        const slavonic = await slavonicName(check.name);

        return respondPrivate({ ...check, slavonic }, { access });
    } catch (e) {
        reportError(e, { where: "app/api/v2/pomyannik/name/route#GET", source: "api" });
        return fail("internal", "Не удалось сверить имя");
    }
}

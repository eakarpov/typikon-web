import { fail, preflight, respond } from "@/lib/api/v2/http";
import { authorize } from "@/lib/api/v2/access";
import { incipitDetail } from "@/lib/api/v2/serialize";
import { LANGUAGES, getIncipit } from "@/lib/incipits";

// Зачин по постоянному адресу: все его вхождения и все соответствия.
//
// Это резолвер, ради которого указатель и выносится наружу. Зачин — рабочий
// ключ отождествления текста между изданиями, и адрес вида
// /api/v2/incipits/cu_gr/воду прошед яко сушу и египетскаго — это то, на что
// можно сослаться в статье и что отдаст текст во всех изданиях, где он есть.
//
// Ключ в адресе — сам зачин, как он лежит в корпусе: нормализованный (без
// ударений, шесть слов, строчными). Своего идентификатора у зачина нет и не
// нужно: ключ и есть идентификатор, и он читаемый.
export const revalidate = 0;

export async function OPTIONS() {
    return preflight();
}

export async function GET(
    request: Request,
    { params }: { params: { lang: string; key: string } },
) {
    const access = await authorize(request, "search");
    if (access.denied) return access.denied;

    if (!(LANGUAGES as readonly string[]).includes(params.lang)) {
        return fail("bad_request", `Язык должен быть одним из: ${LANGUAGES.join(", ")}`);
    }

    let key: string;
    try {
        key = decodeURIComponent(params.key);
    } catch {
        // Битая экранировка — это ошибка запроса, а не сбой сервера.
        return fail("bad_request", "Ключ зачина закодирован неверно");
    }

    try {
        const found = getIncipit(params.lang, key);

        // Здесь «не нашлось» и «корпуса нет» неразличимы изнутри getIncipit, и
        // это осознанно: not_found — верный ответ в обоих случаях для клиента,
        // который спрашивает про конкретный зачин. Отсутствие корпуса целиком
        // видно по ручке-списку, которая отвечает про него прямо.
        if (!found) return fail("not_found", "Зачин не найден");

        return respond(incipitDetail(found), { maxAge: 3600, access });
    } catch (e) {
        console.error(e);
        return fail("internal", "Не удалось собрать зачин");
    }
}

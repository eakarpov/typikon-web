import { fail, preflight, respond } from "@/lib/api/v2/http";
import { authorize } from "@/lib/api/v2/access";
import { lookupWord } from "@/lib/accents/store";

// Ударение одного слова.
//
// Промах отдаётся как 200 с known: false, а не 404 — сознательное отступление от
// остальных ручек v2. В словаре нет и не будет имён собственных, редких форм и
// опечаток исходника: для потребителя (прежде всего синтеза речи) «не знаю» —
// рабочий ответ на каждое десятое слово, а не сбой, и заставлять его на этом
// ловить ошибку значит мешать нормальную работу с поломкой.
export const revalidate = 0;

export async function OPTIONS() {
    return preflight();
}

export async function GET(request: Request, { params }: { params: { word: string } }) {
    const access = await authorize(request, "accents");
    if (access.denied) return access.denied;

    // Кириллица в пути приезжает в процентной кодировке; Next декодирует не всегда.
    let word: string;
    try {
        word = decodeURIComponent(params.word);
    } catch {
        word = params.word;
    }

    if (!word.trim()) {
        return fail("bad_request", "Не указано слово");
    }

    try {
        return respond(await lookupWord(word), { maxAge: 86400, access });
    } catch (e) {
        console.error(e);
        return fail("internal", "Словарь ударений недоступен");
    }
}

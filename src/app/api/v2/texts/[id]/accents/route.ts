import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { fail, preflight, respond } from "@/lib/api/v2/http";
import { authorize } from "@/lib/api/v2/access";
import { getAccentedView } from "@/app/reading/[id]/api";
import { reportError } from "@/lib/reportError";

// ТЕКСТ С РАССТАВЛЕННЫМИ УДАРЕНИЯМИ.
//
// **Корпус остаётся вычитанным.** Здесь отдаётся ВИД: та же книга, но со знаками,
// поставленными машиной по словарю собрания. Решение писать их в сами тексты
// остаётся за хозяином, и показ с него эту срочность снимает, а не подменяет её.
//
// **Спрашивается по идентификатору, а не присылается текстом.** Неверсионированная
// `POST /api/accents/mark` берёт текст в теле, и для приложения не годится втройне:
// предел двадцать тысяч знаков (в «Повести временных лет» — триста сорок девять
// тысяч), ответ потоком токенов вдесятеро тяжелее самого текста, и `POST` пришлось
// бы открывать в CORS. Сервер текст и так держит — незачем слать его обратно.
//
// Отдаётся строка, а не токены: спорные слова разметчик и без того возвращает без
// знака, а выбор из вариантов — поверхность набора, не чтения.
//
// Сутки в кэше: разметка меняется, только когда правят текст или словарь.
export const revalidate = 86400;

export async function OPTIONS() {
    return preflight();
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
    // Раздел `accents` — в свободном наборе: словарь ударений самая дешёвая ручка,
    // и его распространение есть смысл затеи.
    const access = await authorize(request, "accents");
    if (access.denied) return access.denied;

    try {
        const client = await clientPromise;
        const matcher = ObjectId.isValid(params.id)
            ? { _id: new ObjectId(params.id) }
            : { alias: params.id };

        const doc = await client.db("typikon").collection("texts").findOne(matcher);
        if (!doc) return fail("not_found", `Текст «${params.id}» не найден`);

        const view = await getAccentedView(doc, true);

        // Разметки нет — значит текст размечен в самом корпусе (или почти), и
        // предлагать нечего. Пустым содержимым это подменять нельзя: пустое
        // читалось бы как «разметить не вышло», а тут нечего размечать.
        if (!view) {
            return fail("not_found", "Этот текст размечен в самом корпусе — расставлять нечего");
        }

        return respond(view, { maxAge: 86400, access });
    } catch (e) {
        reportError(e, { where: "app/api/v2/texts/[id]/accents/route#GET", source: "api" });
        return fail("internal", "Не удалось расставить ударения");
    }
}

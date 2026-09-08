import { fail, preflight, respond } from "@/lib/api/v2/http";
import { authorize } from "@/lib/api/v2/access";
import { getDayByText } from "@/app/reading/[id]/api";
import { dayDetail } from "@/lib/api/v2/serialize";
import { DAY_SLOT_ORDER, TextType, valueTitle } from "@/utils/texts";
import { reportError } from "@/lib/reportError";

// В КАКОЙ ДЕНЬ ЧИТАЕТСЯ ЭТОТ ТЕКСТ.
//
// Обратный ход к `/api/v2/days/{alias}`: там спрашивают «что читается сегодня»,
// здесь — «когда читается вот это». Приложение ведёт этим путём из текста в
// службу дня, и другого пути у него нет: связь книги с днём в самом тексте не
// записана.
//
// Отвечает той же схемой Day, что и календарь: день — он и есть день, и
// заводить ему второе описание ради другого входа значило бы держать два в
// согласии руками.
export const revalidate = 3600;

export async function OPTIONS() {
    return preflight();
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const access = await authorize(request, "calendar");
    if (access.denied) return access.denied;

    const { id } = await params;

    try {
        const [day, error] = await getDayByText(id);
        if (error) return fail("internal", "Не удалось найти день этого текста");
        // Текст есть, а дня у него нет — обычное дело: не всё, что лежит в
        // корпусе, положено на число. Это `404`, а не пустой день: пустой
        // читался бы как «в этот день ничего не читается».
        if (!day) return fail("not_found", "У этого текста нет дня");

        return respond(
            dayDetail(day, DAY_SLOT_ORDER as readonly string[], (slot) => valueTitle(slot as TextType)),
            { access },
        );
    } catch (e) {
        reportError(e, { where: "app/api/v2/texts/[id]/day/route#GET", source: "api" });
        return fail("internal", "Не удалось найти день этого текста");
    }
}

import { fail, preflight, respond } from "@/lib/api/v2/http";
import { authorize } from "@/lib/api/v2/access";
import { dneslovIdsOf, getSaintByAddress } from "@/lib/saints";
import { memoriesOfSaint } from "@/lib/memories";
import { dedicationsOfSaint } from "@/lib/temples";
import { akathistsOfSaint } from "@/lib/akathists";
import { getItems, getLinkedNoble, getMentions } from "@/app/saints/[id]/api";
import { rulesDb } from "@/lib/rulesDb";
import { saintDossier } from "@/lib/api/v2/serialize";
import { reportError } from "@/lib/reportError";

// Досье святого: запись каталога и всё, что к ней привязано.
//
// Рядом со старой `/api/v2/saints/{id}`, а не вместо: её договор опубликован и
// заморожен, она отдаёт два списка текстов по одному номеру святцев и такой
// останется. Здесь — то, из чего страница святого и состоит.
//
// Адрес принимает и слуг, и номер. Не ради удобства: ссылки на святых стоят в
// разметке самих текстов корпуса номерами, а в святцах и указателе имён —
// слугами, и сузить адрес до одного вида значит сломать половину переходов.
//
// Тексты собираются по ВСЕМ номерам записи. Номеров у одного лица бывает два:
// календарь держит порознь мирское и монашеское имя, лицо и перенесение мощей,
// а свести их — наше редакторское решение. Старая ручка берёт один номер и
// потому отдаёт половину.
export const revalidate = 3600;

export async function OPTIONS() {
    return preflight();
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ address: string }> },
) {
    const access = await authorize(request, "calendar");
    if (access.denied) return access.denied;

    const { address: raw } = await params;

    let address: string;
    try {
        address = decodeURIComponent(raw);
    } catch {
        return fail("bad_request", "Адрес закодирован неверно");
    }
    if (!address.trim()) return fail("bad_request", "Не указан адрес святого");

    try {
        const saint = await getSaintByAddress(address);
        if (!saint) return fail("not_found", "Такого святого в каталоге нет");

        const ids = dneslovIdsOf(saint);

        // Акафисты лежат в отдельном файле корпуса, которого на сервере может не
        // быть. Пустой список тогда значил бы «акафистов нет», а это неправда —
        // мы просто не смотрели. Поэтому корпус проверяется отдельно, и его
        // отсутствие уходит наружу как null.
        const corpus = rulesDb() !== null;

        const [texts, mentions, memories, dedications, noble] = await Promise.all([
            getItems(ids).then(([rows]) => rows ?? []),
            getMentions(ids).then(([rows]) => rows ?? []),
            memoriesOfSaint(ids),
            dedicationsOfSaint(ids),
            getLinkedNoble(ids).then(([row]) => row ?? null),
        ]);

        // Акафист подписан одним номером, а не набором: связка ведётся по памяти.
        const akathists = corpus ? ids.flatMap(id => akathistsOfSaint(id)) : null;

        return respond(
            saintDossier(saint, {
                memories, texts, mentions, akathists, dedications, noble,
            }),
            { access, maxAge: revalidate },
        );
    } catch (e) {
        reportError(e, { where: "app/api/v2/saints/dossier/[address]/route#GET", source: "api" });
        return fail("internal", "Не удалось собрать досье святого");
    }
}

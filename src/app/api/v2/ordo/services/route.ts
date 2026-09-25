import { fail, preflight, respond } from "@/lib/api/v2/http";
import { authorize } from "@/lib/api/v2/access";
import { parseOrdoServices } from "@/lib/api/v2/ordoParams";
import { ordoSutki } from "@/lib/ordo";
import { reportError } from "@/lib/reportError";

// Службы суток собранные: шаги с ролями и текстами, правила, применившиеся
// при сборке, и таблицы подач (viewRules). Сама подача на шаги НЕ наложена —
// её по этим таблицам накладывает клиент (см. lib/ordoView.ts на сайте):
// пять степеней от loud до hidden выбираются читателем, а не навязываются.
//
// Параметр service повторяемый: одна служба — один запрос у сайта, и внешнему
// клиенту тот же совет. Персональных параметров движка (престолы прихода,
// переносы памятей, чин без диакона) здесь нет намеренно — они решаются на
// сайте, а публичному контракту v1 хватает даты, устава, варианта и языка.
export const revalidate = 3600;

export async function OPTIONS() {
    return preflight();
}

export async function GET(request: Request) {
    const access = await authorize(request, "ordo");
    if (access.denied) return access.denied;

    const parsed = parseOrdoServices(new URL(request.url));
    if (!parsed.ok) return fail("bad_request", parsed.error);

    try {
        const sutki = await ordoSutki({
            date: parsed.value.date,
            ustav: parsed.value.ustav ?? undefined,
            variant: parsed.value.variant ?? undefined,
            lang: parsed.value.lang ?? undefined,
            services: parsed.value.services,
        });
        if ("error" in sutki) {
            if (sutki.status === 404) return fail("not_found", sutki.error);
            return fail("ordo_unavailable", sutki.error);
        }
        return respond(sutki, {
            access,
            headers: sutki.version ? { "X-Ordo-Version": sutki.version } : {},
        });
    } catch (e) {
        reportError(e, { where: "app/api/v2/ordo/services/route#GET", source: "api" });
        return fail("internal", "Не удалось собрать службы");
    }
}

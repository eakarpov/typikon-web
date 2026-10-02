import { fail, preflight, respond } from "@/lib/api/v2/http";
import { authorize } from "@/lib/api/v2/access";
import { parseOrdoServices } from "@/lib/api/v2/ordoParams";
import { ordoDayPackage, ordoSutkiFromPackage, ordoViewRules } from "@/lib/ordoPackage";
import { reportError } from "@/lib/reportError";

// Службы суток собранные — в прежнем JSON-контракте, но из пакета .ordo:
// публичный ответ собирается из день-пакета (bodies=free), а не из
// параллельной JSON-выдачи /sutki. Пакет — единственный путь к собранной
// службе; JSON-выдача движка осталась внутренним эталоном паритета.
// Подача на шаги не наложена — её по viewRules накладывает клиент.
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
        const [pkg, rules] = await Promise.all([
            // язык и прочие личные параметры публичный контракт не принимает;
            // тела — всегда gated: скачивает/читает третье лицо.
            ordoDayPackage({
                date: parsed.value.date,
                ustav: parsed.value.ustav ?? undefined,
                variant: parsed.value.variant ?? undefined,
                lang: parsed.value.lang ?? undefined,
            }),
            ordoViewRules(),
        ]);
        if (pkg.error || !pkg.data || !rules) {
            if (pkg.error?.startsWith("404")) {
                return fail("not_found", pkg.error);
            }
            return fail("ordo_unavailable", pkg.error ?? "таблицы подач не пришли");
        }
        const named = parsed.value.services;
        const data = named.length
            ? { ...pkg.data, services: pkg.data.services.filter(s => named.includes(s.key)) }
            : pkg.data;
        return respond(ordoSutkiFromPackage(data, rules, pkg.version), { access });
    } catch (e) {
        reportError(e, { where: "app/api/v2/ordo/services/route#GET", source: "api" });
        return fail("internal", "Не удалось собрать службы");
    }
}

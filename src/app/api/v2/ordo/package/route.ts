import { fail, preflight, respondFile } from "@/lib/api/v2/http";
import { authorize } from "@/lib/api/v2/access";
import { parseOrdoPackage } from "@/lib/api/v2/ordoParams";
import { reportError } from "@/lib/reportError";

// Пакет `.ordo` одной службы — внешний формат последования (spec/package.md
// в typikon-rules): zip с канвой, адресами и телами. Тела отдаются через
// ворота прав: свободные издания лежат в texts/, пять изданий с неразобранной
// лицензией молчат, и манифест говорит об этом счётчиками. Сайт читает тот же
// пакет в режиме internal — все тексты, — и это чтение владельца собственного
// корпуса, а не распространение (rules/rights.yaml, доктрина).
//
// Движок наружу не смотрит: служба по-прежнему на 127.0.0.1, здесь — фасад
// v2 с ключом, квотой и лицензионными заголовками.
export const revalidate = 3600;

export async function OPTIONS() {
    return preflight();
}

export async function GET(request: Request) {
    const access = await authorize(request, "ordo");
    if (access.denied) return access.denied;

    const parsed = parseOrdoPackage(new URL(request.url));
    if (!parsed.ok) return fail("bad_request", parsed.error);

    const root = process.env.ORDO_SERVICE_URL || "";
    if (!root) return fail("ordo_unavailable", "Служба устава не настроена (ORDO_SERVICE_URL)");

    const url = new URL("/package", root);
    url.searchParams.set("date", parsed.value.date);
    url.searchParams.set("service", parsed.value.service);
    url.searchParams.set("bodies", "free");
    for (const [k, v] of Object.entries({
        ustav: parsed.value.ustav, variant: parsed.value.variant, lang: parsed.value.lang,
    })) {
        if (v) url.searchParams.set(k, v);
    }

    try {
        const response = await fetch(url, {
            signal: AbortSignal.timeout(25_000),
            cache: "no-store",
        });
        if (!response.ok) {
            const said = await response.json().then(b => b?.error, () => null);
            if (response.status === 404) return fail("not_found", said ?? "Пакет не найден");
            return fail("ordo_unavailable", said ?? `Служба устава ответила ${response.status}`);
        }
        const body = await response.arrayBuffer();
        const headers: Record<string, string> = {};
        const disposition = response.headers.get("content-disposition");
        if (disposition) headers["Content-Disposition"] = disposition;
        const version = response.headers.get("x-ordo-version");
        if (version) headers["X-Ordo-Version"] = version;
        return respondFile(body, "application/vnd.ordo+zip", { access, headers });
    } catch (e) {
        reportError(e, { where: "app/api/v2/ordo/package/route#GET", source: "api" });
        return fail("ordo_unavailable", e instanceof Error ? e.message : String(e));
    }
}

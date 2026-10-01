import { NextResponse } from "next/server";
import { zipSync } from "fflate";
import { ordoDay } from "@/lib/ordo";
import { parseOrdoDownload } from "@/lib/api/v2/ordoParams";

// Скачивание последования файлом .ordo — посетителю, без ключа: публичный
// /api/v2/ordo/package с ключом остаётся для внешних потребителей, а здесь
// внутренний пропуск, как у /api/ordo/rule. Тела всегда gated (free):
// скачивает третье лицо, и манифест честно считает, что право не выяснило.
// Писание едет адресами (external) — читатель дорезолвит; это осознанный
// пропуск (ROADMAP §5: разбор пяти изданий, резолвер Писания).
//
// Служба названа — один .ordo; не названа — архив дня: все службы выбранного
// варианта, с учётом «вечерня и утреня раздельно», одним zip.
export const dynamic = "force-dynamic";

const base = () => process.env.ORDO_SERVICE_URL || "";

// Один повтор на обрыв: служба отвечает по HTTP/1.0 и закрывает сокет
// (та же причина, что в lib/ordo.ts и lib/ordoPackage.ts).
const fetchBytes = async (url: URL, timeoutMs = 25_000): Promise<Uint8Array> => {
    for (let attempt = 1; ; attempt++) {
        try {
            const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
            if (!response.ok) {
                const said = await response.json().then(b => b?.error, () => null);
                const err = new Error(`${response.status}${said ? `: ${said}` : ""}`);
                (err as any).status = response.status;
                throw err;
            }
            return new Uint8Array(await response.arrayBuffer());
        } catch (e) {
            const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
            if (attempt < 2 && !timedOut) continue;
            throw e;
        }
    }
};

const fail = (status: number, error: string) =>
    NextResponse.json({ error }, { status });

const serviceUrl = (p: { date: string; service: string | null; ustav: string | null; variant: string | null }) => {
    const url = new URL("/package", base());
    url.searchParams.set("date", p.date);
    if (p.service) url.searchParams.set("service", p.service);
    url.searchParams.set("bodies", "free");
    if (p.ustav) url.searchParams.set("ustav", p.ustav);
    if (p.variant) url.searchParams.set("variant", p.variant);
    return url;
};

const zipHeaders = (filename: string, type: string) => ({
    "Content-Type": type,
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "private, max-age=300",
});

export async function GET(request: Request) {
    const parsed = parseOrdoDownload(new URL(request.url));
    if (!parsed.ok) return fail(400, parsed.error);
    const p = parsed.value;

    if (!base()) return fail(503, "Служба устава не настроена (ORDO_SERVICE_URL)");

    if (p.service) {
        try {
            const bytes = await fetchBytes(serviceUrl(p));
            return new NextResponse(bytes as unknown as BodyInit, {
                headers: zipHeaders(`${p.date}-${p.service}.ordo`, "application/vnd.ordo+zip"),
            });
        } catch (e) {
            const status = (e as any)?.status;
            if (status === 404) return fail(404, "Служба не найдена");
            return fail(503, "Служба устава не отвечает");
        }
    }

    // АРХИВ ДНЯ: службы выбранного варианта, как их показывает страница —
    // без вошедших во всенощное; раздельное бдение выкидывает всенощное
    // и малую вечерню.
    const day = await ordoDay(p.date, { ustav: p.ustav ?? undefined });
    if (!day) return fail(503, "Служба устава не отвечает");
    const variant = day.variants.find(v => v.key === (p.variant ?? undefined)) ?? day.variants[0];
    if (!variant) return fail(404, "Уставу нечего предложить на этот день");

    const services = variant.services.filter(s => p.razdelno
        ? s.key !== "vsenoshchnoe" && s.key !== "vespers-small"
        : !s.replacedBy);
    if (!services.length) return fail(404, "В выбранном варианте нет служб для выгрузки");

    try {
        const entries: Record<string, Uint8Array> = {};
        const got = await Promise.all(services.map(async s => {
            try {
                return [s.key, await fetchBytes(serviceUrl({ ...p, service: s.key }))] as const;
            } catch {
                return null;
            }
        }));
        for (const item of got) {
            if (item) entries[`${p.date}-${item[0]}.ordo`] = item[1];
        }
        if (!Object.keys(entries).length) return fail(503, "Не удалось собрать ни одной службы");
        const archive = zipSync(entries);
        return new NextResponse(archive as unknown as BodyInit, {
            headers: zipHeaders(`${p.date}.zip`, "application/zip"),
        });
    } catch {
        return fail(503, "Служба устава не отвечает");
    }
}

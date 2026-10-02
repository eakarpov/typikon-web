import { NextResponse } from "next/server";
import { parseOrdoDownload } from "@/lib/api/v2/ordoParams";

// Скачивание последования файлом .ordo — посетителю, без ключа: публичный
// /api/v2/ordo/package с ключом остаётся для внешних потребителей, а здесь
// внутренний пропуск, как у /api/ordo/rule. Тела всегда gated (free):
// скачивает третье лицо, и манифест честно считает, что право не выяснило.
// Писание едет адресами (external) — читатель дорезолвит по публичному
// контракту из spec/package.md; это осознанный пропуск (ROADMAP §5).
//
// Служба названа — пакет одной службы; не названа — ДЕНЬ одним пакетом
// (формат 1.1, manifest.scope.services). Обёртка-архив из первой редакции
// ушла: формат сам стал дневным.
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

const packageUrl = (p: { date: string; service: string | null; ustav: string | null; variant: string | null }) => {
    const url = new URL("/package", base());
    url.searchParams.set("date", p.date);
    if (p.service) url.searchParams.set("service", p.service);
    url.searchParams.set("bodies", "free");
    if (p.ustav) url.searchParams.set("ustav", p.ustav);
    if (p.variant) url.searchParams.set("variant", p.variant);
    return url;
};

export async function GET(request: Request) {
    const parsed = parseOrdoDownload(new URL(request.url));
    if (!parsed.ok) return fail(400, parsed.error);
    const p = parsed.value;

    if (!base()) return fail(503, "Служба устава не настроена (ORDO_SERVICE_URL)");

    try {
        const bytes = await fetchBytes(packageUrl(p));
        const filename = p.service ? `${p.date}-${p.service}.ordo` : `${p.date}.ordo`;
        return new NextResponse(bytes as unknown as BodyInit, {
            headers: {
                "Content-Type": "application/vnd.ordo+zip",
                "Content-Disposition": `attachment; filename="${filename}"`,
                "Cache-Control": "private, max-age=300",
            },
        });
    } catch (e) {
        if ((e as any)?.status === 404) return fail(404, "Служба или день не найдены");
        return fail(503, "Служба устава не отвечает");
    }
}

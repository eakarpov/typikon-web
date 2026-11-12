import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/authorize/sessions";
import { restorePersons } from "@/lib/pomyannik/service";
import { BackupError, MAX_BACKUP_MB, MAX_BACKUP_BYTES } from "@/lib/pomyannik/backup";

export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session) return new NextResponse(null, { status: 401 });
    if (Number(request.headers.get("content-length")) > MAX_BACKUP_BYTES) return NextResponse.json({ error: `Файл больше ${MAX_BACKUP_MB} МБ.` }, { status: 413 });
    // Ограничиваем поток, включая запросы без Content-Length.
    const reader = request.body?.getReader();
    if (!reader) return NextResponse.json({ error: "Нет файла." }, { status: 400 });
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BACKUP_BYTES) { await reader.cancel(); return NextResponse.json({ error: `Файл больше ${MAX_BACKUP_MB} МБ.` }, { status: 413 }); }
        chunks.push(value);
    }
    let raw: unknown;
    try { raw = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { return NextResponse.json({ error: "Не удалось прочитать JSON-файл." }, { status: 400 }); }
    try {
        return NextResponse.json(await restorePersons(session.id, raw), { headers: { "Cache-Control": "private, no-store" } });
    } catch (e) {
        if (e instanceof BackupError) return NextResponse.json({ error: e.message }, { status: 400 });
        throw e;
    }
}

import { NextResponse } from "next/server";
import { loadParallelWork } from "@/lib/kruczie/parallelServer";
export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: { code: string } }) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/u.test(params.code)) return NextResponse.json({error:"Invalid public work code"},{status:400});
    try { return NextResponse.json(await loadParallelWork(params.code),{headers:{"Cache-Control":"public, max-age=3600"}}); }
    catch { return NextResponse.json({error:"Parallel corpus is unavailable"},{status:503}); }
}

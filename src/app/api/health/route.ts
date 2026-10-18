import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { deploymentReadiness } from "@/lib/readiness";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
    const body = await deploymentReadiness(
        () => readFile(join(process.cwd(), ".next/BUILD_ID"), "utf8"),
        async () => (await clientPromise).db("typikon").command({ ping: 1 }, { timeoutMS: 2000 }),
    );
    return NextResponse.json(body, {
        status: body.status === "ready" ? 200 : 503,
        headers: { "Cache-Control": "no-store" },
    });
}

import {NextRequest, NextResponse} from "next/server";
import {saveReport} from "@/app/api/report/service";

export async function POST(request: NextRequest) {
    const body = await request.json();

    await saveReport(body);

    return NextResponse.json(null, {
        status: 200,
    });
}

export async function DELETE(request: NextRequest) {
    const body = await request.json();

    console.log(body);

    return NextResponse.json(null, {
        status: 405,
    });
}

import {NextRequest, NextResponse} from "next/server";

export async function POST(request: NextRequest) {
    const body = await request.json();

    console.log(body);

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

import {NextRequest, NextResponse} from "next/server";
import {getNotes} from "@/app/api/notes/services";

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const params = new URLSearchParams(url.searchParams);
    const id = params.get('id');
    if (!id) {
        return NextResponse.json(null, {
            status: 400,
        });
    }
    const notes = await getNotes(id);

    return NextResponse.json(notes, {
        status: 200,
    });
}

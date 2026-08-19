import {NextRequest, NextResponse} from "next/server";
import {getSession} from "@/lib/authorize/sessions";
import {deleteUserNote, updateUserNote} from "@/app/api/user-notes/service";

export async function PUT(request: NextRequest, {params}: {params: {id: string}}) {
    const session = await getSession();
    if (!session) {
        return new NextResponse(null, {status: 401});
    }

    const {id} = params;
    const body = await request.json();
    if (!body.note) {
        return new NextResponse(null, {status: 400});
    }

    const updated = await updateUserNote(session.id, id, body.note);
    if (!updated) {
        return new NextResponse(null, {status: 404});
    }
    return new NextResponse(null, {status: 200});
}

export async function DELETE(request: NextRequest, {params}: {params: {id: string}}) {
    const session = await getSession();
    if (!session) {
        return new NextResponse(null, {status: 401});
    }

    const {id} = params;
    const deleted = await deleteUserNote(session.id, id);
    if (!deleted) {
        return new NextResponse(null, {status: 404});
    }
    return new NextResponse(null, {status: 200});
}

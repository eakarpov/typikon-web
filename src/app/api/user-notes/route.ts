import {NextRequest, NextResponse} from "next/server";
import {getSession} from "@/lib/authorize/sessions";
import {createUserNote, getAllUserNotes, getUserNotesForText} from "@/app/api/user-notes/service";

export async function GET(request: NextRequest) {
    const session = await getSession();
    if (!session) {
        return new NextResponse(null, {status: 401});
    }

    const textId = request.nextUrl.searchParams.get("textId");
    const notes = textId
        ? await getUserNotesForText(session.id, textId)
        : await getAllUserNotes(session.id);

    return NextResponse.json(notes, {status: 200});
}

export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session) {
        return new NextResponse(null, {status: 401});
    }

    const body = await request.json();
    if (!body.textId || !body.selection || !body.note) {
        return new NextResponse(null, {status: 400});
    }

    const id = await createUserNote(session.id, body.textId, body.selection, body.note);
    return NextResponse.json({id}, {status: 200});
}

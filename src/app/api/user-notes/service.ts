import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";

// Отдельная коллекция от редакторских typikon.notes (сноски note_(\d+)#,
// вшитые в texts.content админом, публичные) — эта, наоборот, приватная
// для каждого пользователя, живёт в typikon-users.

export const createUserNote = async (userId: string, textId: string, selection: any, note: string) => {
    const client = await clientPromise;
    const db = client.db("typikon-users");
    const now = new Date();
    const result = await db.collection("userNotes").insertOne({
        userId, textId, selection, note, createdAt: now, updatedAt: now,
    });
    return result.insertedId.toString();
};

export const getUserNotesForText = async (userId: string, textId: string) => {
    const client = await clientPromise;
    const db = client.db("typikon-users");
    const notes = await db.collection("userNotes")
        .find({userId, textId})
        .sort({createdAt: 1})
        .toArray();
    return notes.map((n) => ({...n, id: n._id.toString(), _id: undefined}));
};

// userNotes.textId ссылается на typikon.texts._id — другая база, $lookup
// между базами ненадёжен на community MongoDB, поэтому дотягиваем имена
// текстов отдельным запросом и мёрджим руками.
export const getAllUserNotes = async (userId: string) => {
    const client = await clientPromise;
    const db = client.db("typikon-users");
    const notes = await db.collection("userNotes")
        .find({userId})
        .sort({updatedAt: -1})
        .toArray();

    const textIds = [...new Set(notes.map((n) => n.textId as string))].filter((id) => ObjectId.isValid(id));
    let textNames: Record<string, string> = {};
    if (textIds.length > 0) {
        const contentDb = client.db("typikon");
        const texts = await contentDb.collection("texts")
            .find({_id: {$in: textIds.map((id) => new ObjectId(id))}}, {projection: {name: 1}})
            .toArray();
        textNames = Object.fromEntries(texts.map((t) => [t._id.toString(), t.name]));
    }

    return notes.map((n) => ({
        ...n, id: n._id.toString(), _id: undefined,
        textName: textNames[n.textId as string] || null,
    }));
};

export const updateUserNote = async (userId: string, noteId: string, note: string) => {
    if (!ObjectId.isValid(noteId)) return false;
    const client = await clientPromise;
    const db = client.db("typikon-users");
    const result = await db.collection("userNotes").updateOne(
        {_id: new ObjectId(noteId), userId},
        {$set: {note, updatedAt: new Date()}},
    );
    return result.matchedCount > 0;
};

export const deleteUserNote = async (userId: string, noteId: string) => {
    if (!ObjectId.isValid(noteId)) return false;
    const client = await clientPromise;
    const db = client.db("typikon-users");
    const result = await db.collection("userNotes").deleteOne({_id: new ObjectId(noteId), userId});
    return result.deletedCount > 0;
};

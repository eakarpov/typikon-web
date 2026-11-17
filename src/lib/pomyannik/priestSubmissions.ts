import type { Db, InsertOneOptions } from 'mongodb';
import { NoteError } from './note';
export interface NoteSubmission { id: string; fingerprint: string }
export async function priorSubmission(db: Db, fromUserId: string, submission: NoteSubmission) {
    const note = await db.collection('zapiski').findOne({ fromUserId, submissionId: submission.id });
    if (note && note.submissionFingerprint !== submission.fingerprint)
        throw new NoteError('Этот запрос уже использован для другой записки. Откройте подачу заново');
    return note;
}
/** A lost response or two retries insert exactly one immutable snapshot. */
export async function insertNoteSnapshot(db: Db, note: any, submission?: NoteSubmission, options?: InsertOneOptions) {
    const notes = db.collection('zapiski');
    if (submission) {
        await notes.createIndex({ fromUserId: 1, submissionId: 1 }, { unique: true,
            partialFilterExpression: { submissionId: { $type: 'string' } } });
        const prior = await priorSubmission(db, note.fromUserId, submission);
        if (prior) return prior;
    }
    const doc = { ...note, ...(submission ? { submissionId: submission.id, submissionFingerprint: submission.fingerprint } : {}) };
    try {
        const result = await notes.insertOne(doc, options);
        return { ...doc, _id: result.insertedId };
    } catch (e: any) {
        if (submission && e?.code === 11000) {
            const prior = await priorSubmission(db, note.fromUserId, submission);
            if (prior) return prior;
        }
        throw e;
    }
}

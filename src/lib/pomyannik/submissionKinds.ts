import { NOTE_KINDS } from './types';
import { SERVICE_KINDS } from './priestQueueRules';
/** Full vocabulary remains available for history and printed notes. */
export const SUBMITTABLE_NOTE_KINDS = NOTE_KINDS.filter(k => SERVICE_KINDS.some(kind => kind === k.key));
export const canSubmitNoteKind = (kind: string) => SERVICE_KINDS.some(allowed => allowed === kind);
export const SUBMISSION_KIND_MESSAGE = 'Сейчас можно подать записку только на проскомидию, панихиду или молебен';

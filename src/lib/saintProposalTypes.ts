// Очередь разбора святых из памятей Минеи — виды и подписи, без базы: их читает и страница разбора в браузере.

export type ProposalReason = "no-name" | "no-epithet" | "several" | "possible-duplicate";
export type ProposalStatus = "new" | "created" | "merged" | "dismissed";

export const REASON_LABELS: Record<ProposalReason, string> = {
    "no-epithet": "без прозвания — тёзок не различить",
    "several": "в подписи несколько лиц",
    "possible-duplicate": "похоже на запись каталога",
    "no-name": "имени в подписи не нашлось",
};

export interface ProposalMemory { id: string; book: string; label: string; date: string; chin: string | null }

export interface Proposal {
    id: string;
    name: string | null;
    reason: ProposalReason;
    duplicates: { id: string; name: string; slug: string | null }[];
    memories: ProposalMemory[];
    status: ProposalStatus;
}

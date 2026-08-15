import {TextingProposalStatus} from "@/utils/texting";

export interface ITextingProposal {
    _id: string;
    userId: string;
    textId: string;
    content: string;
    comment?: string;
    status: TextingProposalStatus;
    createdAt: string;
    updatedAt: string;
    reviewedAt?: string;
    reviewedBy?: string;
    rejectionReason?: string;
}

export enum TextingProposalStatus {
    PENDING = "pending",
    APPROVED = "approved",
    REJECTED = "rejected",
}

export const printTextingProposalStatus = (status: TextingProposalStatus) => {
    switch (status) {
        case TextingProposalStatus.PENDING:
            return "На рассмотрении";
        case TextingProposalStatus.APPROVED:
            return "Принято";
        case TextingProposalStatus.REJECTED:
            return "Отклонено";
        default:
            return "Неизвестный статус";
    }
};

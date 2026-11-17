import type { OrdoTransfer } from "./ordo";

/** Строка адреса `ID` или `ID:primary` — так перенос лежит в адресе страницы. */
export const parseTransfer = (raw: string): OrdoTransfer | null => {
    const [memoryId, flag] = raw.split(":");
    return memoryId?.trim() ? { memoryId: memoryId.trim(), primary: flag === "primary" } : null;
};

export const formatTransfer = (t: OrdoTransfer) =>
    t.primary ? `${t.memoryId}:primary` : t.memoryId;


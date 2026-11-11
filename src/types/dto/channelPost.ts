export interface TelegramPostCheck {
    status: "passed" | "failed";
    checkedAt: string;
    error?: string;
    textLength?: number;
    shortened?: boolean;
    photo?: {width: number; height: number; format: string; bytes: number};
}

export interface TelegramDelivery {
    fingerprint: string;
    photoMessageId?: number;
    messageId?: number;
    complete: boolean;
}

export type ChannelPostSlot = "morning" | "evening";
export type ChannelPostStatus = "draft" | "ready" | "published" | "skipped" | "failed";
export type ChannelPostNameSource = "dneslov" | "heuristic" | "none";

export interface ChannelPostTargets {
    telegram: boolean;
    vk: boolean;
}

export interface ChannelPostDTO {
    id: string;
    dayAlias: string;
    date: string;
    slot: ChannelPostSlot;
    scheduledAt: string;
    sourceTextId: string | null;
    sourceTextName: string | null;
    dneslovId?: string | null;
    dneslovSlug?: string | null;
    text: string;
    imageUrl: string | null;
    hashtags: string[];
    nameSource: ChannelPostNameSource;
    status: ChannelPostStatus;
    targets: ChannelPostTargets;
    createdAt: string;
    updatedAt: string;
    publishedAt?: string | null;
    publishError?: string | null;
    telegramDelivery?: TelegramDelivery | null;
    telegramCheck?: TelegramPostCheck | null;
}

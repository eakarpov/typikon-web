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
}

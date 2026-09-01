import { cookies } from "next/headers";
import { decrypt } from "@/lib/authorize/sessions";
import { getItem } from "@/app/profile/api";
import { capsOf, type Capability, type UserLike } from "@/lib/rights";

// Кто сейчас смотрит. Отдельно от словаря прав (lib/rights): тот читают и
// скрипты, и клиент, а это — только сервер, у него cookies и база.

/** Кто сейчас смотрит: id и его возможности. */
export const viewer = async (): Promise<{
    userId: string | null; user: UserLike | null; caps: Set<Capability>;
}> => {
    const cookie = (await cookies()).get("session")?.value;
    const session = await decrypt(cookie);
    const userId = (session?.userId as string | undefined) ?? null;
    if (!userId) return { userId: null, user: null, caps: new Set() };
    const [user] = await getItem(userId);
    return { userId, user: (user ?? null) as UserLike | null, caps: capsOf(user) };
};

/** Может ли тот, кто сейчас смотрит. */
export const can = async (cap: Capability): Promise<boolean> =>
    (await viewer()).caps.has(cap);


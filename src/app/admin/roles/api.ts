import clientPromise from "@/lib/mongodb";
import { capsOf } from "@/lib/rights";

export interface RoleRow {
    email: string; name: string | null; roles: string[]; caps: string[]; legacy: boolean;
}

export const getGranted = async (): Promise<RoleRow[]> => {
    const users = (await clientPromise).db("typikon-users").collection("users");
    const rows = await users.find(
        { $or: [{ roles: { $exists: true, $ne: [] } }, { isAdmin: true }] },
        { projection: { email: 1, name: 1, roles: 1, isAdmin: 1 } },
    ).toArray();
    return rows.map(u => ({
        email: (u.email as string) ?? String(u._id),
        name: (u.name as string) ?? null,
        roles: (u.roles as string[]) ?? [],
        caps: [...capsOf(u as never)],
        // прежний маркер читается наравне с ролями, но его видно отдельно:
        // пока он жив, о правах человека сказано в двух местах
        legacy: Boolean(u.isAdmin),
    }));
};

import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { getTemple } from "@/lib/temples";
import { adminsOf, rightsOn, staleDays } from "@/lib/parish/access";
import { Manage, type AdminRow } from "./Manage";

export const metadata: Metadata = { title: "Кто ведёт расписание", robots: { index: false } };

const Page = async ({ params }: { params: Promise<{ slug: string }> }) => {
    const { slug } = await params;
    const temple = await getTemple(slug);
    if (!temple) notFound();

    const rights = await rightsOn(slug);
    const admins = await adminsOf(slug);

    // Почты — одной выборкой: имена людей лежат в другой базе, и ходить туда
    // по одному значило бы столько же запросов, сколько ведущих
    const ids = [...new Set(admins.flatMap(a => [a.userId, a.addedBy]).filter(Boolean) as string[])]
        .map(v => { try { return new ObjectId(v); } catch { return null; } })
        .filter(Boolean) as ObjectId[];
    const users = new Map((await (await clientPromise).db("typikon-users")
        .collection("users").find({ _id: { $in: ids } }, { projection: { email: 1, name: 1 } })
        .toArray()).map(u => [String(u._id), u]));

    const rows: AdminRow[] = admins.map(a => ({
        userId: a.userId,
        email: (users.get(a.userId)?.email as string) ?? null,
        name: (users.get(a.userId)?.name as string) ?? null,
        addedByEmail: a.addedBy ? (users.get(a.addedBy)?.email as string) ?? null : null,
        staleDays: staleDays(a),
        isMe: a.userId === rights.userId,
    }));

    return (
        <div style={{ maxWidth: "44rem", margin: "0 auto", padding: "1rem" }}>
            <h1 style={{ fontSize: "1.3rem" }}>Кто ведёт расписание</h1>
            <p style={{ color: "#666" }}>
                {temple.name} · <Link href={`/parish/${slug}`}>расписание</Link>
            </p>
            {rights.canInvite ? (
                <div style={{ marginTop: "1rem" }}>
                    <Manage slug={slug} rows={rows} />
                </div>
            ) : (
                <p style={{ marginTop: "1rem", color: "#555" }}>
                    Расписание этого храма ведут {rows.length === 0 ? "пока никто" : rows.length}.
                    {" "}Позвать может только тот, кто уже ведёт.
                </p>
            )}
        </div>
    );
};

export default Page;

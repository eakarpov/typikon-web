import Link from "next/link";
import clientPromise from "@/lib/mongodb";
import { templesOf } from "@/lib/parish/access";

// Храмы, расписание которых ведёт этот человек. Пусто — ничего не показываем:
// большинству входящих это ни о чём.
const MyTemples = async ({ userId }: { userId: string }) => {
    const mine = await templesOf(userId);
    if (!mine.length) return null;

    const temples = await (await clientPromise).db("typikon").collection("temples")
        .find({ slug: { $in: mine.map(m => m.templeSlug) } },
              { projection: { slug: 1, name: 1, place: 1 } }).toArray();
    const byslug = new Map(temples.map(t => [t.slug as string, t]));

    return (
        <div style={{ margin: "1rem 0" }}>
            <p><b>Вы ведёте расписание:</b></p>
            {mine.map(m => {
                const t = byslug.get(m.templeSlug);
                return (
                    <p key={m.templeSlug} style={{ margin: ".2rem 0" }}>
                        <Link href={`/parish/${m.templeSlug}`}>
                            {(t?.name as string) ?? m.templeSlug}
                        </Link>
                        {t?.place ? <span style={{ color: "#888" }}> · {t.place as string}</span> : null}
                        {" · "}
                        <Link href={`/parish/${m.templeSlug}/admins`}
                              style={{ fontSize: ".9rem" }}>кто ведёт</Link>
                    </p>
                );
            })}
        </div>
    );
};

export default MyTemples;

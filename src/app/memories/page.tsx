import { Metadata } from "next";
import Link from "next/link";
import { setMeta } from "@/lib/meta";
import { myFont } from "@/utils/font";
import { SIGN_LABELS } from "@/utils/chantLabels";
import { addressOf, BOOK_LABELS, getMemoryRows } from "@/lib/memories";

// Указатель памятей. Раздел отдельный от /saints нарочно: там ЛИЦА, здесь
// СЛУЖБЫ. Под иконой, Господним праздником или собором лица нет вовсе или их
// много, а служба есть всегда — она и назначена книгой на своё место.

export const metadata: Metadata = {
    title: "Реестр памятей",
    description: "Службы богослужебных книг: где стоит каждая, какой у неё знак и на чём этот знак основан.",
    openGraph: {
        title: "Реестр памятей",
        description: "Службы богослужебных книг: где стоит каждая, какой у неё знак и на чём этот знак основан.",
        url: "//www.typikon.su/memories/",
    },
};

const MemoriesList = async ({ book }: { book: string }) => {
    const all = await getMemoryRows();
    const rows = book ? all.filter(m => m.book === book) : all;

    const byBook = all.reduce<Record<string, number>>((acc, m) => {
        acc[m.book] = (acc[m.book] ?? 0) + 1; return acc;
    }, {});

    return (
        <div style={{ maxWidth: "52rem", margin: "0 auto", padding: "1rem" }}>
            <h1 style={{ fontSize: "1.5rem" }}>Реестр памятей</h1>
            <p style={{ color: "#666" }}>
                Служба, назначенная книгой на своё место. У Минеи это число месяца, у Триодей —
                отступ от Пасхи, у Октоиха — глас и день седмицы, у Минеи общей — разряд святого.
            </p>

            <div style={{ margin: "1rem 0", display: "flex", gap: ".75rem", flexWrap: "wrap" }}>
                <Link href="/memories" style={{ fontWeight: book ? "normal" : "bold" }}>
                    все {all.length}
                </Link>
                {Object.entries(byBook).sort((a, b) => b[1] - a[1]).map(([b, n]) => (
                    <Link key={b} href={`/memories?book=${b}`}
                          style={{ fontWeight: book === b ? "bold" : "normal" }}>
                        {BOOK_LABELS[b] ?? b} {n}
                    </Link>
                ))}
            </div>

            <ul style={{ listStyle: "none", padding: 0 }}>
                {rows.map(m => (
                    <li key={m.memoryId} style={{ padding: ".4rem 0", borderBottom: "1px solid #eee" }}>
                        <Link href={`/memories/${m.memoryId}`}>{m.label}</Link>
                        <div style={{ color: "#777", fontSize: ".9rem" }}>
                            {addressOf(m)}
                            {m.sign?.default && ` · ${SIGN_LABELS[m.sign.default] ?? m.sign.default}`}
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};

const Page = ({ searchParams }: { searchParams: { book?: string } }) => {
    setMeta();
    return (
        <div className={myFont.variable}>
            <MemoriesList book={searchParams.book ?? ""} />
        </div>
    );
};

export default Page;

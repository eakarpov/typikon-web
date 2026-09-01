import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTemple } from "@/lib/temples";
import { ZONES } from "@/lib/timezones";
import { rightsOn } from "@/lib/parish/access";
import { settingsFor } from "@/lib/parish/settings";
import { Rules } from "./Rules";

export const metadata: Metadata = { title: "Правила прихода", robots: { index: false } };

const Page = async ({ params }: { params: Promise<{ slug: string }> }) => {
    const { slug } = await params;
    const temple = await getTemple(slug);
    if (!temple) notFound();

    const rights = await rightsOn(slug);
    const settings = await settingsFor(temple);

    return (
        <div style={{ maxWidth: "48rem", margin: "0 auto", padding: "1rem" }}>
            <h1 style={{ fontSize: "1.3rem" }}>Как у нас служат</h1>
            <p style={{ color: "#666" }}>
                {temple.name} · <Link href={`/parish/${slug}`}>расписание</Link>
            </p>
            <p style={{ color: "#555", marginTop: ".5rem" }}>
                Что служится — говорит устав, и это не правится. Здесь только час
                и то, чего приход не служит: расписание складывается из устава и
                этих правил, и по каждой строке видно, откуда взялся её час.
            </p>

            {rights.canEdit ? (
                <div style={{ marginTop: "1rem" }}>
                    <Rules slug={slug} rules={settings.rules} own={settings.ownRules}
                           timezone={settings.timezone} timezoneHow={settings.timezoneHow}
                           zones={Object.keys(ZONES).sort()} />
                </div>
            ) : (
                <p style={{ marginTop: "1rem", color: "#555" }}>
                    Правила видит и правит тот, кто ведёт расписание этого храма.
                </p>
            )}
        </div>
    );
};

export default Page;

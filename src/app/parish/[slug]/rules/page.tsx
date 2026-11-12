import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTemple } from "@/lib/temples";
import { ZONES } from "@/lib/timezones";
import { rightsOn } from "@/lib/parish/access";
import { settingsFor } from "@/lib/parish/settings";
import {civilYear} from "@/lib/parish/civilCalendar";
import {defaultPractice} from "@/lib/parish/practice";
import { Rules } from "./Rules";

export const metadata: Metadata = { title: "Постоянное расписание прихода", robots: { index: false } };

const Page = async ({ params }: { params: Promise<{ slug: string }> }) => {
    const { slug } = await params;
    const temple = await getTemple(slug);
    if (!temple) notFound();

    const rights = await rightsOn(slug);
    const settings = await settingsFor(temple);

    return (
        <div style={{ maxWidth: "48rem", margin: "0 auto", padding: "1rem" }}>
            <h1 style={{ fontSize: "1.3rem" }}>Постоянное расписание</h1>
            <p style={{ color: "#666" }}>
                {temple.name} · <Link href={`/parish/${slug}`}>расписание</Link>
            </p>
            <p style={{ color: "#555", marginTop: ".5rem" }}>
                Постоянное время и состав богослужений. Для отдельной даты их можно
                переопределить в редакторе расписания. Разовые правки сохраняются.
            </p>

            {rights.canEdit ? (
                <div style={{ marginTop: "1rem" }}>
                    <Rules slug={slug} practice={settings.practice??defaultPractice(temple.country??'')}
                           timezone={settings.timezone} zones={Object.keys(ZONES).sort()}
                           calendarAvailable={!!await civilYear(settings.practice?.country??temple.country??'',new Date().getUTCFullYear())} />
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

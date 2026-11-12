import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/authorize/sessions";
import { getBookSettings, listPersons } from "@/lib/pomyannik/service";
import { myFont } from "@/utils/font";
import Reader from "./Reader";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Чтение помянника — Уставные чтения", robots: { index: false, follow: false } };
export default async function Page() {
    const session = await getSession();
    if (!session) return <p className="font-serif py-4"><Link href="/login" className="underline">Войдите</Link>, чтобы открыть помянник.</p>;
    const [persons, settings] = await Promise.all([listPersons(session.id), getBookSettings(session.id)]);
    return <div className={myFont.variable}><Reader persons={persons} place={settings.readingPlace} showSignatures={settings.showSignatures} /></div>;
}

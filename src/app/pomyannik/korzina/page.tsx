import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/authorize/sessions";
import { listTrash } from "@/lib/pomyannik/service";
import { myFont } from "@/utils/font";
import Trash from "./Trash";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Корзина помянника — Уставные чтения", robots: { index: false, follow: false } };
export default async function Page() {
    const session = await getSession();
    if (!session) return <p className="font-serif py-4"><Link href="/login" className="underline">Войдите</Link>, чтобы открыть корзину.</p>;
    return <div className={myFont.variable}><Trash initial={await listTrash(session.id)} /></div>;
}

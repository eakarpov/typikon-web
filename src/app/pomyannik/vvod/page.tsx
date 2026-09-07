import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/authorize/sessions";
import { myFont } from "@/utils/font";
import Import from "@/app/pomyannik/vvod/Import";

export const metadata: Metadata = {
    title: "Вписать списком — Помянник",
    robots: { index: false, follow: false },
};

const VvodPage = async () => {
    const cookie = (await cookies()).get("session")?.value;
    const session = await decrypt(cookie);
    if (!session?.userId) {
        return (
            <div className={`${myFont.variable} pt-2 max-w-2xl`}>
                <p className="font-serif">
                    <Link href="/login" className="text-red-900 hover:underline">Войдите</Link>,
                    чтобы вести помянник.
                </p>
            </div>
        );
    }

    return (
        <div className={`${myFont.variable} pt-2 flex flex-col gap-5`}>
            <div className="max-w-2xl">
                <h1 className="font-bold font-serif">Вписать списком</h1>
                <p className="font-serif text-slate-800 mt-2">
                    Перепишите помянник как он есть — строкой на имя. Пометы и даты через
                    запятую, в любом порядке. Заголовки «о здравии» и «о упокоении» разводят
                    имена по разворотам.
                </p>
                <p className="font-serif text-slate-600 text-sm mt-2">
                    Крест или «ум.» перед датой делает лицо усопшим; «р.» — день рождения,
                    «кр.» — крещения. Чего мы не поймём, попадёт в подпись о родстве, и вы это
                    увидите: <strong>разбор показывается прежде записи</strong>.
                </p>
            </div>

            <Import />

            <p className="font-serif text-sm">
                <Link href="/pomyannik" className="text-red-900 hover:underline">← помянник</Link>
            </p>
        </div>
    );
};

export default VvodPage;

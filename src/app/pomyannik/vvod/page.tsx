import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { readSessionPayload } from "@/lib/authorize/sessions";
import { myFont } from "@/utils/font";
import Import from "@/app/pomyannik/vvod/Import";

export const metadata: Metadata = {
    title: "Импорт имён — Помянник",
    robots: { index: false, follow: false },
};

const VvodPage = async () => {
    const cookie = (await cookies()).get("session")?.value;
    const session = await readSessionPayload(cookie);
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
                <h1 className="font-bold font-serif">Импорт имён</h1>
                <p className="font-serif text-slate-800 mt-2">
                    Загрузите Excel, CSV или текстовый файл с именами либо вставьте список ниже. Для вставленного текста — одна строка на имя. Пометы и даты через
                    запятую, в любом порядке. Заголовки «о здравии» и «о упокоении» разводят
                    имена по разворотам.
                </p>
                <p className="font-serif text-slate-600 text-sm mt-2">
                    Крест или «ум.» перед датой делает лицо усопшим; «р.» — день рождения,
                    «кр.» — крещения. Чего мы не поймём, попадёт в подпись о родстве, и вы это
                    увидите: <strong>разбор показывается прежде записи</strong>.
                </p>
            </div>

            <p className="font-serif text-sm text-slate-600">Неполные даты тоже поддерживаются: «Николай, р.1950» или «Иоанн, †12.03». Неизвестный год подставляться не будет.</p>
            <Import />

            <p className="font-serif text-sm">
                <Link href="/pomyannik" className="text-red-900 hover:underline">← помянник</Link>
            </p>
        </div>
    );
};

export default VvodPage;

import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/authorize/sessions";
import { myFont, csFont } from "@/utils/font";
import { commemoratorOf } from "@/lib/pomyannik/commemorators";
import { notesFor } from "@/lib/pomyannik/zapiski";
import { AFTER_DAYS, UNREAD_DAYS } from "@/lib/pomyannik/note";
import Inbox from "@/app/pomyannik/prinyatye/Inbox";

export const metadata: Metadata = {
    title: "Поданные записки — Помянник",
    robots: { index: false, follow: false },
};

const PrinyatyePage = async () => {
    const cookie = (await cookies()).get("session")?.value;
    const session = await decrypt(cookie);
    const userId = session?.userId as string | undefined;
    if (!userId) {
        return (
            <div className={`${myFont.variable} pt-2 max-w-2xl`}>
                <p className="font-serif">
                    <Link href="/login" className="text-red-900 hover:underline">Войдите</Link>.
                </p>
            </div>
        );
    }

    const person = await commemoratorOf(userId);
    if (!person) {
        return (
            <div className={`${myFont.variable} pt-2 max-w-2xl flex flex-col gap-3`}>
                <h1 className="font-bold font-serif">Поданные записки</h1>
                <p className="font-serif text-slate-800">
                    Приём записок вам пока не открыт.{" "}
                    <Link href="/pomyannik/priem" className="text-red-900 hover:underline">
                        Подать заявку
                    </Link>.
                </p>
            </div>
        );
    }

    const notes = await notesFor(userId);

    return (
        <div className={`${myFont.variable} ${csFont.variable} pt-2 flex flex-col gap-5`}>
            <div className="max-w-2xl">
                <h1 className="font-bold font-serif">Поданные записки</h1>
                <p className="font-serif text-slate-600 text-sm mt-2">
                    Записка хранится не вечно: прочитанная стирается через {AFTER_DAYS} дней после
                    прочтения, длящаяся — через {AFTER_DAYS} дней после конца срока, а так и не
                    прочитанная — через {UNREAD_DAYS}. В ней <strong>имена третьих лиц</strong>, и
                    держать их дольше поминовения не за чем; запись о том, что и когда подавали,
                    остаётся.
                </p>
            </div>

            <Inbox initial={JSON.parse(JSON.stringify(notes))} />

            <nav className="flex flex-wrap gap-4 font-serif text-sm border-t pt-3">
                <Link href="/pomyannik/priem" className="text-red-900 hover:underline">
                    ← настройки приёма
                </Link>
                <Link href="/pomyannik" className="text-red-900 hover:underline">помянник</Link>
            </nav>
        </div>
    );
};

export default PrinyatyePage;

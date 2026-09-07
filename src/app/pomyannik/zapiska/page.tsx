import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/authorize/sessions";
import { myFont, csFont } from "@/utils/font";
import { listPersons } from "@/lib/pomyannik/service";
import { slavonicNames } from "@/lib/pomyannik/slavonic";
import Zapiska from "@/app/pomyannik/zapiska/Zapiska";

export const metadata: Metadata = {
    title: "Записка — Помянник",
    robots: { index: false, follow: false },
};

const ZapiskaPage = async () => {
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

    const persons = await listPersons(session.userId as string);
    // Славянские формы считаются на сервере разом на весь помянник: выбор имён
    // должен показывать записку сразу, а не ходить в базу на каждую галочку.
    const slavonic = await slavonicNames(persons.map(p => p.churchName || p.name));

    return (
        <div className={`${myFont.variable} ${csFont.variable} pt-2 flex flex-col gap-6`}>
            <div className="max-w-2xl print:hidden">
                <h1 className="font-bold font-serif">Записка</h1>
                <p className="font-serif text-slate-800 mt-2">
                    Соберите записку из имён помянника. Имена ставятся церковнославянским
                    письмом в родительном падеже — так их и читают.
                </p>
                <p className="font-serif text-slate-600 text-sm mt-2">
                    Склонение порождается по словарной схеме личных имён. Имени, которого в
                    словаре нет, мы <strong>не склоняем и говорим об этом</strong>: оно
                    останется в том виде, в каком вы его вписали.
                </p>
                <p className="font-serif text-slate-600 text-sm mt-2">
                    Отсюда записку можно распечатать и отнести самому. Чтобы подать её
                    священнику через сайт, откройте его{" "}
                    <Link href="/pominovenie" className="text-red-900 hover:underline">
                        страницу приёма
                    </Link>{" "}
                    или ссылку-приглашение, какую он дал.
                </p>
            </div>

            {persons.length === 0 ? (
                <p className="font-serif text-sm text-slate-600">
                    Помянник пока пуст.{" "}
                    <Link href="/pomyannik/vvod" className="text-red-900 hover:underline">
                        Вписать имена
                    </Link>.
                </p>
            ) : (
                <Zapiska persons={persons} slavonic={slavonic} />
            )}
        </div>
    );
};

export default ZapiskaPage;

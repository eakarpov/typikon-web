import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/authorize/sessions";
import { myFont, csFont } from "@/utils/font";
import { commemoratorByCode } from "@/lib/pomyannik/commemorators";
import { listPersons } from "@/lib/pomyannik/service";
import { slavonicNames } from "@/lib/pomyannik/slavonic";
import Zapiska from "@/app/pomyannik/zapiska/Zapiska";

// ПОДАЧА ПО ССЫЛКЕ-ПРИГЛАШЕНИЮ.
//
// Ссылку раздаёт сам священник — в руки, на стенде, в приходском чате.
// Оттого страница закрыта от поиска: попадать сюда должны те, кому её дали, а
// не всякий, кто искал «подать записку».

export const metadata: Metadata = {
    title: "Подать записку",
    robots: { index: false, follow: false },
};

const PodatPage = async (props: { params: Promise<{ code: string }> }) => {
    const { code } = await props.params;
    const to = await commemoratorByCode(code);
    if (!to) notFound();

    const cookie = (await cookies()).get("session")?.value;
    const session = await decrypt(cookie);
    const userId = session?.userId as string | undefined;

    if (!userId) {
        return (
            <div className={`${myFont.variable} pt-2 max-w-2xl flex flex-col gap-3`}>
                <h1 className="font-bold font-serif">Подать записку: {to.title}</h1>
                <p className="font-serif text-slate-800">
                    Записка собирается из вашего помянника — имена в ней приходят проверенными и
                    в церковной форме. Для этого нужно{" "}
                    <Link href="/login" className="text-red-900 hover:underline">войти</Link>.
                </p>
                {/* Барьер объясняем: он выглядит преградой к молитве, а поставлен
                    ради того, кто согласился поминать */}
                <p className="font-serif text-slate-600 text-sm">
                    Вход нужен не нам: без него это открытый ящик, куда пишет кто угодно и
                    сколько угодно, а разбирать его придётся тому, кто согласился поминать.
                </p>
            </div>
        );
    }

    const persons = await listPersons(userId);
    const slavonic = await slavonicNames(persons.map(p => p.churchName || p.name));

    return (
        <div className={`${myFont.variable} ${csFont.variable} pt-2 flex flex-col gap-6`}>
            <div className="max-w-2xl print:hidden">
                <h1 className="font-bold font-serif">Подать записку</h1>
                <p className="font-serif text-slate-800 mt-2">
                    Принимает <strong>{to.title}</strong>
                    {to.place && <>, {to.place}</>}.
                </p>
                {to.about && (
                    <p className="font-serif text-slate-600 text-sm mt-2 whitespace-pre-wrap">
                        {to.about}
                    </p>
                )}
                <p className="font-serif text-slate-600 text-sm mt-2">
                    Оплаты здесь нет. Записка идёт священнику напрямую; сайт в
                    этом не участвует и ничего с этого не имеет. Что положено за поминовение —
                    решается не здесь.
                </p>
            </div>

            {persons.length === 0 ? (
                <p className="font-serif text-sm text-slate-600">
                    Ваш помянник пока пуст.{" "}
                    <Link href="/pomyannik/vvod" className="text-red-900 hover:underline">
                        Вписать имена
                    </Link>.
                </p>
            ) : (
                <Zapiska persons={persons} slavonic={slavonic}
                         to={{ title: to.title, place: to.place, code, accepts: to.accepts }} />
            )}
        </div>
    );
};

export default PodatPage;

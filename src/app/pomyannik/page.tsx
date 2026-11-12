import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { readSessionPayload } from "@/lib/authorize/sessions";
import { slavonicNames } from "@/lib/pomyannik/slavonic";
import { myFont, csFont } from "@/utils/font";
import { allNames } from "@/lib/imeniny/store";
import { getBookSettings, listPersons } from "@/lib/pomyannik/service";
import { upcoming } from "@/lib/pomyannik/reckoning";
import Book from "@/app/pomyannik/Book";
import BackupTools from "./BackupTools";
import Upcoming from "@/app/pomyannik/Upcoming";

// ПОМЯННИК.
//
// Имена лежат один раз и сами приносят даты: девятый и сороковой день,
// годовщины, именины, поминальные субботы. До сих пор всё это человек держал в
// голове, а сороковой день считал на пальцах.
//
// СТРАНИЦА ЗАКРЫТАЯ ЦЕЛИКОМ. В помяннике лежат имена родни, даты смерти и
// пометы вроде «болящий» — сведения о живых людях, которые этого сайта не
// выбирали. Ни одной части этого нельзя показать без сессии, и ни строчки из
// этого не должно попасть в поисковую выдачу.

export const metadata: Metadata = {
    title: "Помянник — Уставные чтения",
    description: "Личный помянник: имена, дни памяти, сорокоуст и именины.",
    robots: { index: false, follow: false },
};

const DAYS = 45;

const PomyannikPage = async () => {
    const cookie = (await cookies()).get("session")?.value;
    const session = await readSessionPayload(cookie);
    const userId = session?.userId as string | undefined;

    if (!userId) {
        return (
            <div className={`${myFont.variable} pt-2 flex flex-col gap-4 max-w-2xl`}>
                <h1 className="font-bold font-serif">Помянник</h1>
                <p className="font-serif text-slate-800">
                    Помянник хранится при вашей учётной записи и виден только вам.{" "}
                    <Link href="/login" className="text-red-900 hover:underline">Войдите</Link>,
                    чтобы завести его.
                </p>
            </div>
        );
    }

    const [persons, names, settings] = await Promise.all([listPersons(userId), allNames(), getBookSettings(userId)]);
    const forms = await slavonicNames(persons.map(p=>p.churchName||p.name));
    const events = upcoming(persons, undefined, DAYS);

    return (
        <div className={`${myFont.variable} ${csFont.variable} pt-2 flex flex-col gap-6`}>
            <div className="max-w-2xl">
                <h1 className="font-bold font-serif">Помянник</h1>
                <p className="font-serif text-slate-800 mt-2">
                    Имена, по которым вы поминаете. Даты считаются от них сами: девятый и
                    сороковой день, годовщины, именины и общие поминальные дни года.
                </p>
                {/* Оговорка вверху, как в именинах и в трапезе: счёт дней —
                    обычай, и принять его за уставное предписание проще всего
                    там, где он посчитан машиной */}
                <p className="font-serif text-slate-600 text-sm mt-2">
                    <strong>День преставления считается первым.</strong> Оттого третий день —
                    через два дня после кончины, а сороковой — через тридцать девять. Счёт этот
                    повсеместен, но он обычай счисления, а не уставное предписание.
                </p>
            </div>

            {persons.length > 0 && (
                <section className="flex flex-col gap-2">
                    <h2 className="font-bold font-serif text-sm">
                        Ближайшее <span className="font-normal text-slate-400">
                            · {DAYS} дней
                        </span>
                    </h2>
                    <Upcoming events={events} days={DAYS} />
                </section>
            )}

            <nav className="flex flex-wrap gap-4 font-serif text-sm" aria-label="Чтение и печать помянника">
                <Link href="/pomyannik/chtenie" className="text-red-900 underline">Читать помянник</Link>
                <Link href="/pomyannik/korzina" className="text-red-900 underline">Корзина</Link>
                <Link href="/pomyannik/print" className="text-red-900 underline">Печать личного помянника</Link>
            </nav>

            <Book forms={forms} initial={persons} names={names.map(n => n.name)} showSignatures={settings.showSignatures} />

            <nav className="flex flex-wrap gap-4 font-serif text-sm border-t pt-3">
                <Link href="/pomyannik/vvod" className="text-red-900 hover:underline">
                    вписать списком →
                </Link>
                <Link href="/pomyannik/zapiska" className="text-red-900 hover:underline">
                    собрать записку →
                </Link>
                <Link href="/pomyannik/kalendar" className="text-red-900 hover:underline">
                    поминальные дни и подписка →
                </Link>
                <Link href="/pominovenie" className="text-red-900 hover:underline">
                    кому подать записку →
                </Link>
            </nav>

            <BackupTools persons={persons} />

            <section className="max-w-2xl">
                <h2 className="font-serif font-bold text-sm">Откуда это взято</h2>
                <p className="font-serif text-sm text-slate-600 mt-1">
                    Именины считаются по указателю имён святцев — ближайшая память после дня
                    рождения. Обычай этот народный: Церковь единого порядка не устанавливает, и
                    свои именины вы вправе назвать сами. Сам указатель{" "}
                    <strong>выведен нами</strong> разбором заголовков святцев и неполон: имени в
                    нём может не оказаться, и это не значит, что имени нет.{" "}
                    <Link href="/imeniny" className="text-red-900 hover:underline">
                        Подробнее об именинах
                    </Link>.
                </p>
            </section>
        </div>
    );
};

export default PomyannikPage;

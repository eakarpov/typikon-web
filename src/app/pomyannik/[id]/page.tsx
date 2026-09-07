import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/authorize/sessions";
import { myFont, csFont } from "@/utils/font";
import { getPerson } from "@/lib/pomyannik/service";
import { memorialDays, sorokoustSpan, upcoming } from "@/lib/pomyannik/reckoning";
import { slavonicName } from "@/lib/pomyannik/slavonic";
import { displayName, humanDate, rankGenitive, weekdayOf, YEARS } from "@/app/pomyannik/labels";
import Card from "@/app/pomyannik/[id]/Card";
import Upcoming from "@/app/pomyannik/Upcoming";

// Заголовок общий, без имени: вкладка браузера и история — не то место, где
// имени из чужого помянника стоит показываться через плечо.
export const metadata: Metadata = {
    title: "Помянник — Уставные чтения",
    robots: { index: false, follow: false },
};

const SOURCE_NOTE: Record<string, string> = {
    lexicon: "имя склонено по словарной схеме — это настоящий родительный падеж",
    accents: "имени в словаре нет: письмо и ударение наши, а падеж остался прежним",
    plain: "имени в словаре нет, и перевести его в церковное письмо мы не смогли",
};

const PersonPage = async (props: { params: Promise<{ id: string }> }) => {
    const { id } = await props.params;
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

    const person = await getPerson(session.userId as string, id);
    if (!person) notFound();

    const slavonic = await slavonicName(person.churchName || person.name);
    const memorial = person.died ? memorialDays(person.died) : null;
    const sorokoust = person.sorokoust ? sorokoustSpan(person.sorokoust.from) : null;
    const ahead = upcoming([person], undefined, 400);

    return (
        <div className={`${myFont.variable} ${csFont.variable} pt-2 flex flex-col gap-6`}>
            <div>
                <h1 className="font-bold font-serif">
                    {displayName(person)}
                    {person.relation && (
                        <span className="font-normal text-slate-400 text-sm"> · {person.relation}</span>
                    )}
                </h1>
                {/* КАК ИМЯ ПРОЧТУТ В ЗАПИСКЕ — с оговоркой об источнике: наш
                    именительный падеж, принятый за проверенный родительный, —
                    худшее, что здесь может выйти */}
                <p className="mt-2 font-serif text-slate-800">
                    В записке:{" "}
                    <span className="font-sans-serif text-lg">
                        {[rankGenitive(person.rank, person.sex), slavonic.genitive]
                            .filter(Boolean).join(" ")}
                    </span>
                </p>
                <p className="font-serif text-xs text-slate-500 mt-1">
                    {SOURCE_NOTE[slavonic.source]}
                </p>
            </div>

            {memorial && person.died && (
                <section className="font-serif text-sm flex flex-col gap-1">
                    <h2 className="font-bold">Дни поминовения</h2>
                    <p className="text-slate-800">
                        Преставился {humanDate(person.died)}
                        {memorial.years >= 1 && <> — {YEARS(memorial.years)} назад</>}.
                        {memorial.newlyDeparted && (
                            <span className="text-amber-700"> Сорок дней ещё не прошло: новопреставленный.</span>
                        )}
                    </p>
                    <ul className="text-slate-600">
                        <li>третий день — {humanDate(memorial.third)}, {weekdayOf(memorial.third)}</li>
                        <li>девятый день — {humanDate(memorial.ninth)}, {weekdayOf(memorial.ninth)}</li>
                        <li>сороковой день — {humanDate(memorial.fortieth)}, {weekdayOf(memorial.fortieth)}</li>
                    </ul>
                    <p className="text-slate-500 text-xs">
                        День преставления считается первым. Счёт этот обычай, а не устав.
                    </p>
                </section>
            )}

            {sorokoust && person.sorokoust && (
                <section className="font-serif text-sm">
                    <h2 className="font-bold">Сорокоуст</h2>
                    <p className="text-slate-800">
                        Заказан {humanDate(person.sorokoust.from)}
                        {person.sorokoust.where && <>, {person.sorokoust.where}</>}.{" "}
                        {sorokoust.done
                            ? <>Окончен {humanDate(sorokoust.to)}.</>
                            : <>Идёт: {sorokoust.passed} из сорока, оканчивается {humanDate(sorokoust.to)}.</>}
                    </p>
                </section>
            )}

            {ahead.length > 0 && (
                <section className="flex flex-col gap-2">
                    <h2 className="font-bold font-serif text-sm">Впереди на год</h2>
                    <Upcoming events={ahead} days={400} />
                </section>
            )}

            <section className="flex flex-col gap-3">
                <h2 className="font-bold font-serif text-sm border-t pt-3">Запись</h2>
                <Card person={person} />
            </section>

            <p className="font-serif text-sm">
                <Link href="/pomyannik" className="text-red-900 hover:underline">← помянник</Link>
            </p>
        </div>
    );
};

export default PersonPage;

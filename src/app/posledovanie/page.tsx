import { Suspense } from "react";
import type { Metadata } from "next";
import { ordoDay, ordoOptions, parseTransfer, type OrdoDay, type OrdoTransfer } from "@/lib/ordo";
import { viewChoices } from "@/lib/ordoView";
import { MONTH_OF } from "@/utils/chantLabels";
import { myFont } from "@/utils/font";
import Calendar from "./Calendar";
import Controls from "./Controls";
import MemoryChoice from "./MemoryChoice";
import ServiceLoader from "./ServiceLoader";
import { all, dateOf, first, type SearchParams } from "./params";

// ПОСЛЕДОВАНИЕ НА ДЕНЬ — суточный круг по дате.
//
// Чем отличается от /ustav. Там конструктор: канву, знак и праздник задают
// руками, чтобы увидеть и невозможное. Здесь спрашивается только то, чего из
// даты не вывести, — устав, язык, вариант, переносы, — а службы суток,
// их порядок и место в сутках называет устав.
//
// Как устроено ожидание. Шапка дня (/day) лёгкая и приходит сразу. Каждая
// служба — свой Suspense и свой запрос: первая показывается, не дожидаясь
// литургии, а день движок считает однажды и держит в кэше. Подача («указания»,
// полное, тетрадь чтеца) переключается на клиенте, без нового запроса: шаги
// приходят нейтральными, как в пакете .ordo.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Последование на день — Уставные чтения",
    description:
        "Суточный круг по Типикону на выбранный день: от вечерни накануне до литургии, " +
        "богослужебными указаниями, полным текстом или тетрадью действующего лица.",
};

// ПОРЯДОК СТОЯНИЙ — по часам, а не по уставному «день начинается вечером».
// Вечер накануне и так стоит первым: у него своя, прежняя дата. А вечер того
// же числа — повечерие Пасхи, вечерня, приделанная к литургии, — наступает
// после ночи и дня, а не до них (движок ставит вечер первым в пределах даты).
const PART_CLOCK: Record<string, number> = { noch: 0, utro: 1, den: 2, vecher: 3 };
const byClock = <T extends { civil: string; part: string }>(a: T, b: T) =>
    a.civil.localeCompare(b.civil) || (PART_CLOCK[a.part] ?? 9) - (PART_CLOCK[b.part] ?? 9);

const civilLabel = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return `${d} ${MONTH_OF[m]} ${y}`;
};

const DayHead = ({ day }: { day: OrdoDay }) => {
    const bits = [
        `по церковному счёту ${day.churchDate.day} ${MONTH_OF[day.churchDate.month]}`,
        day.weekdayLabel,
        day.tone ? `глас ${day.tone}` : "гласа нет",
    ];
    if (day.triodLabel) bits.push(`Триодь: ${day.triodLabel}`);
    return (
        <div className="mb-4">
            <h1 className="font-serif text-2xl">{civilLabel(day.date)}</h1>
            <div className="font-serif text-sm text-slate-600">{bits.join(" · ")}</div>
        </div>
    );
};

const Posledovanie = async ({ searchParams }: { searchParams: SearchParams }) => {
    const date = dateOf(searchParams);
    const ustav = first(searchParams.ustav) || undefined;
    const transfers = all(searchParams.perenos)
        .map(parseTransfer).filter((t): t is OrdoTransfer => t !== null);

    const [options, day] = await Promise.all([
        ordoOptions(),
        ordoDay(date, { ustav, transfers }),
    ]);

    // key — чтобы при переходе на другой день сетка открылась его месяцем
    const calendar = <Suspense><Calendar key={date} date={date} /></Suspense>;

    if (!day || !options) {
        return (
            <div className={`${myFont.variable} flex flex-col md:flex-row gap-6`}>
                <aside className="md:w-64 shrink-0">{calendar}</aside>
                <p className="font-serif text-slate-600">
                    Последование сейчас недоступно: служба устава не отвечает
                    {transfers.length > 0 && " (или не узнала перенесённую память)"}.
                </p>
            </div>
        );
    }

    const variant = day.variants.find(v => v.key === first(searchParams.variant))
        ?? day.variants[0];
    // ВСЕНОЩНОЕ ИЛИ РАЗДЕЛЬНО. Устав назначил бдение — и вечерня с утреней в
    // него вошли; но «идеже всенощных не бывает» книга допускает прямо (гл. 7),
    // и выбор этот не наш. По умолчанию — бдение.
    const razdelno = first(searchParams.bdenie) === "0";
    const hasVigil = variant?.services.some(s => s.key === "vsenoshchnoe") ?? false;

    const common = {
        date,
        ustav,
        variant: variant?.key,
        transfers,
        lang: first(searchParams.lang),
        parallel: first(searchParams.parallel),
        psalms: first(searchParams.psalms),
    };
    const choices = viewChoices(options);
    // КЛЮЧ ВСЕГО ВОПРОСА — на границах Suspense. С прежними ключами React при
    // переходе не прячет уже показанное и ждёт, пока соберутся ВСЕ службы
    // нового дня, — адрес не менялся по десятку секунд. С новым ключом
    // границы новые, и каждая сразу показывает «собирается».
    const queryKey = JSON.stringify({ ...common, razdelno });

    return (
        <div className={`${myFont.variable} flex flex-col md:flex-row gap-6`}>
            <aside className="md:w-64 shrink-0 flex flex-col gap-4">
                {calendar}
                <Suspense>
                    <Controls options={options} choices={choices}
                              ustav={ustav || options.ustavy[0]?.ustav || ""}
                              lang={common.lang || options.languages[0]?.key || ""}
                              hasVigil={hasVigil} razdelno={razdelno} />
                </Suspense>
            </aside>

            <div className="flex-1 min-w-0">
                <DayHead day={day} />
                <Suspense>
                    <MemoryChoice day={day} variantKey={variant?.key ?? null} />
                </Suspense>

                {!variant && (
                    <p className="font-serif text-slate-600">Уставу нечего предложить на этот день.</p>
                )}

                <div key={queryKey}>
                {[...(variant?.stoyaniya ?? [])].sort(byClock).map(st => {
                    const services = st.services.filter(s => razdelno
                        ? s.key !== "vsenoshchnoe" && s.key !== "vespers-small"
                        : !s.replacedBy);
                    if (!services.length) return null;
                    return (
                        <section key={st.key} className="mt-6">
                            <h2 className="font-serif text-lg text-red-900 border-b border-slate-200 pb-1">
                                {civilLabel(st.civil)}, {st.partLabel}
                            </h2>
                            {st.why.map(w => (
                                <p key={w} className="font-serif text-xs text-slate-500 mt-1">{w}</p>
                            ))}
                            <div className="flex flex-col gap-2 mt-2">
                                {services.map(s => (
                                    <Suspense key={s.key} fallback={
                                        <div className="font-serif text-slate-400 py-2">
                                            {s.label} — собирается…
                                        </div>
                                    }>
                                        <ServiceLoader query={{ ...common, services: [s.key] }}
                                                       label={s.label} />
                                    </Suspense>
                                ))}
                            </div>
                        </section>
                    );
                })}
                </div>
            </div>
        </div>
    );
};

export default Posledovanie;

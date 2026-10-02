import { Suspense } from "react";
import type { Metadata } from "next";
import { ordoDay, ordoOptions, parseTransfer, type OrdoDay, type OrdoTransfer } from "@/lib/ordo";
import { viewChoices } from "@/lib/ordoView";
import { MONTH_OF } from "@/utils/chantLabels";
import { myFont } from "@/utils/font";
import Calendar from "./Calendar";
import Controls from "./Controls";
import MemoryChoice from "./MemoryChoice";
import PackageMode from "./PackageMode";
import ServicesBlock, { type ServicesCommon } from "./ServicesBlock";
import { all, dateOf, first, type SearchParams } from "./params";

// ПОСЛЕДОВАНИЕ НА ДЕНЬ — суточный круг по дате.
//
// Чем отличается от /ustav. Там конструктор: канву, знак и праздник задают
// руками, чтобы увидеть и невозможное. Здесь спрашивается только то, чего из
// даты не вывести, — устав, язык, вариант, переносы, — а службы суток,
// их порядок и место в сутках называет устав.
//
// Как устроено ожидание. Шапка дня (/day) лёгкая и приходит сразу. Суточный
// круг — один запрос: день-пакет .ordo (spec/package.md) со всеми службами,
// телами и указаниями; подача («указания», полное, тетрадь чтеца)
// переключается на клиенте, без нового запроса: шаги уже здесь, нейтральные.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Последование на день — Уставные чтения",
    description:
        "Суточный круг по Типикону на выбранный день: от вечерни накануне до литургии, " +
        "богослужебными указаниями, полным текстом или тетрадью действующего лица.",
};

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

// ВСЕНОЩНОЕ ИЛИ РАЗДЕЛЬНО. Устав назначил бдение — и вечерня с утреней в
// него вошли; но «идеже всенощных не бывает» книга допускает прямо (гл. 7),
// и выбор этот не наш. По умолчанию — бдение.
const razdelnoOf = (params: SearchParams, hasVigil: boolean) =>
    hasVigil && first(params.bdenie) === "0";

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
    const razdelno = razdelnoOf(searchParams, variant?.services.some(s => s.key === "vsenoshchnoe") ?? false);

    const common: ServicesCommon = {
        ustav,
        variant: variant?.key,
        transfers,
        lang: first(searchParams.lang),
        parallel: first(searchParams.parallel),
        psalms: first(searchParams.psalms),
    };
    const choices = viewChoices(options);
    const downloadDay = (() => {
        const q = new URLSearchParams({ date });
        if (variant) q.set("variant", variant.key);
        if (ustav) q.set("ustav", ustav);
        if (razdelno) q.set("bdenie", "0");
        return `/api/ordo/package?${q.toString()}`;
    })();
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
                              hasVigil={variant?.services.some(s => s.key === "vsenoshchnoe") ?? false}
                              razdelno={razdelno} />
                </Suspense>
            </aside>

            <div className="flex-1 min-w-0">
                <PackageMode>
                <DayHead day={day} />
                <div className="flex items-baseline gap-3 mt-1 flex-wrap">
                    <a download href={downloadDay}
                       className="text-xs font-serif text-slate-600 border border-slate-200 rounded px-2 py-1 hover:bg-slate-50">
                        Скачать день (.ordo)
                    </a>
                    <span className="text-[11px] text-slate-400 font-serif">
                        день одним пакетом: тексты свободных изданий, Писание — адресами;
                        что молчит и почему, скажет манифест
                    </span>
                </div>
                <Suspense>
                    <MemoryChoice day={day} variantKey={variant?.key ?? null} />
                </Suspense>

                {!variant && (
                    <p className="font-serif text-slate-600">Уставу нечего предложить на этот день.</p>
                )}

                <div key={queryKey}>
                    <Suspense fallback={
                        <div className="font-serif text-slate-400 py-2">Последование собирается…</div>
                    }>
                        <ServicesBlock day={day} common={common} razdelno={razdelno} />
                    </Suspense>
                </div>
                </PackageMode>
            </div>
        </div>
    );
};

export default Posledovanie;

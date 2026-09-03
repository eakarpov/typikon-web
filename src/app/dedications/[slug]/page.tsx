import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { myFont } from "@/utils/font";
import { setMeta } from "@/lib/meta";
import {
    ENOUGH_FOR_DIFFUSION, ENOUGH_FOR_STATS, feastDate, formatFeastDate, getDedication, getDedicationStats,
} from "@/lib/temples";
import { SIGN_LABELS } from "@/utils/chantLabels";
import { countryLabel } from "@/utils/jurisdictions";
import { temples as templesCount } from "@/utils/plural";
import YearChart from "@/app/dedications/YearChart";
import DedicationMap from "@/app/dedications/[slug]/DedicationMap";
import DiffusionMap from "@/app/dedications/[slug]/DiffusionMap";

// География посвящения: где почитание живёт и когда оно разошлось.
//
// ЧТО ЗДЕСЬ ВООБЩЕ ПОКАЗЫВАЕТСЯ. Три вопроса, на которые до сих пор отвечали
// впечатлением, а не числом:
//
//   где кончается почитание — радиусом ареала: у Димитрия Прилуцкого он
//     меряется десятками вёрст, у Николая Чудотворца сотнями;
//   когда оно разошлось — волной построек рядом с датой прославления;
//   что посвящение говорит о возрасте здания — медианой года и границами
//     половины: Никольский храм скорее всего начала XIX века, а
//     Александро-Невский — конца.
//
// ГЛАВНАЯ ОГОВОРКА, БЕЗ КОТОРОЙ ВСЁ ЭТО ЛОЖЬ: сырое число храмов на карте
// показывает не почитание, а плотность населения. Поэтому по странам считается
// ПРЕВЫШЕНИЕ над общей долей посвящения в каталоге, а не количество.

export const generateMetadata = async ({ params }: { params: { slug: string } }): Promise<Metadata> => {
    const dedication = await getDedication(params.slug);
    if (!dedication) return { title: "Посвящение не найдено" };
    return {
        title: `${dedication.short} — география посвящения`,
        description: `Где стоят храмы этого посвящения, когда они строились и что за память устава за ним стоит.`,
    };
};

const KIND_LABELS: Record<string, string> = {
    gospodskiy: "Господский престол",
    bogorodichen: "Богородичный престол",
    svyatogo: "престол святого",
};

const DedicationPage = async ({ params }: { params: { slug: string } }) => {
    setMeta();
    const dedication = await getDedication(params.slug);
    if (!dedication) notFound();

    const stats = await getDedicationStats(params.slug);
    const year = new Date().getUTCFullYear();
    const enough = stats.count >= ENOUGH_FOR_STATS;

    return (
        <div className={`pt-2 ${myFont.variable}`}>
            <h1 className="font-serif text-2xl mb-1">{dedication.short}</h1>
            <p className="font-serif text-slate-500 mb-4">
                {KIND_LABELS[dedication.kind] ?? dedication.kind}; {dedication.label}
            </p>

            <section className="mb-6">
                <h2 className="font-serif text-lg mb-1">Престольный праздник</h2>
                <ul className="font-serif">
                    {dedication.feasts?.length ? dedication.feasts.map((f, i) => {
                        const date = feastDate(f, year);
                        return (
                            <li key={i}>
                                {date ? formatFeastDate(date) : "дата не выяснена"}
                                {f.paschaOffset !== undefined && (
                                    <span className="text-sm text-slate-500"> — день подвижный, от Пасхи</span>
                                )}
                                {f.note && <span className="text-sm text-slate-500"> ({f.note})</span>}
                                {f.memoryLabel && (
                                    <div className="text-sm text-slate-600">
                                        {f.memoryLabel}
                                        {f.sign && ` — ${SIGN_LABELS[f.sign] ?? f.sign}`}
                                    </div>
                                )}
                            </li>
                        );
                    }) : (
                        <li className="text-slate-500">Память этого посвящения ещё не выяснена.</li>
                    )}
                </ul>
            </section>

            <section className="mb-6">
                <h2 className="font-serif text-lg mb-1">
                    {templesCount(stats.count)} в каталоге
                </h2>
                {enough ? (
                    <ul className="font-serif text-slate-700">
                        <li>
                            Ареал: половина храмов стоит не далее {stats.radiusMedianKm} км от средоточия,
                            четыре пятых — не далее {stats.radius80Km} км.
                            <span className="text-sm text-slate-500">
                                {" "}Десятки вёрст — почитание местное, сотни — общее.
                            </span>
                        </li>
                        {stats.years ? (
                            <li>
                                Год постройки: медиана {stats.years.median}, половина храмов между{" "}
                                {stats.years.q1} и {stats.years.q3}.
                                <span className="text-sm text-slate-500">
                                    {" "}Год известен у {stats.years.known} из {stats.count}.
                                </span>
                            </li>
                        ) : (
                            <li className="text-slate-500">
                                Год постройки известен слишком у немногих, чтобы говорить об эпохе.
                            </li>
                        )}
                    </ul>
                ) : (
                    <p className="font-serif text-slate-600">
                        Храмов слишком мало, чтобы выводить из них ареал и эпоху: по десятку точек
                        такие меры говорят больше о полноте каталога, чем о почитании. Ниже — карта.
                    </p>
                )}
            </section>

            {/* Волну рисуем по тому же порогу, что и меры: по трём годам она
                показывает не почитание, а полноту каталога. */}
            {stats.years && stats.decades.length > 1 && (
                <section className="mb-6">
                    <h2 className="font-serif text-lg mb-1">Когда строили</h2>
                    <YearChart decades={stats.decades} canonized={dedication.canonized} />
                    <p className="font-serif text-sm text-slate-500">
                        По полувекам, только там, где год известен: он проставлен у части записей
                        Wikidata и почти никогда — у записей OpenStreetMap.
                        {dedication.canonized && ` Черта — прославление, ${dedication.canonized} год.`}
                    </p>
                </section>
            )}

            <section className="mb-6">
                <h2 className="font-serif text-lg mb-1">Где стоят</h2>
                <DedicationMap dedication={params.slug} />
            </section>

            {/* КАК РАСХОДИЛОСЬ — та же география, провёрнутая по полувекам.
                Показываем только там, где датированных хватает: по десятку точек
                на три века движущаяся карта показывает полноту каталога, а не
                почитание, и показывает убедительно — тем и опасна. */}
            {stats.years && stats.years.known >= ENOUGH_FOR_DIFFUSION && (
                <section className="mb-6">
                    <h2 className="font-serif text-lg mb-1">Как расходилось</h2>
                    {/* Доля датированных — в шапке раздела, а не сноской внизу:
                        читатель должен знать, какую часть каталога он видит,
                        ДО того, как сделает вывод из увиденного. */}
                    <p className="font-serif text-slate-600 mb-2">
                        На карте только датированные храмы: {stats.years.known} из {stats.count}.
                        Год известен лишь у записей Wikidata — у записей OpenStreetMap
                        его нет ни у одной.
                    </p>
                    <DiffusionMap dedication={params.slug} />
                    <div className="font-serif text-sm text-slate-500 mt-2">
                        <p>
                            Год здесь — год ЗДАНИЯ, а не первого храма этого посвящения на
                            этом месте: сгоревший деревянный храм XVI века приходит на карту
                            каменным XIX-го. Оттого «появление» на карте может отставать от
                            почитания на век и больше — у Серафима Саровского самый ранний
                            датированный храм 1890 года при прославлении 1903-го, и это год
                            постройки, а не посвящения.
                        </p>
                        <p className="mt-1">
                            Пустое место на карте значит «нет датированных записей», а не
                            «нет почитания»: во всём каталоге года нет почти у девяти храмов
                            из десяти. Поэтому «где кончается ареал» здесь — вопрос, а не ответ.
                        </p>
                    </div>
                </section>
            )}

            {stats.countries.length > 1 && (
                <section className="mb-6">
                    <h2 className="font-serif text-lg mb-1">По странам</h2>
                    <table className="font-serif text-sm">
                        <thead>
                            <tr className="text-slate-500">
                                <th className="text-left pr-4">страна</th>
                                <th className="text-right pr-4">храмов</th>
                                <th className="text-right">чаще обычного</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.countries.map((c) => (
                                <tr key={c.code}>
                                    <td className="pr-4">{countryLabel(c.code)}</td>
                                    <td className="text-right pr-4">{c.count}</td>
                                    <td className="text-right">
                                        {c.lift >= 1 ? `в ${c.lift.toFixed(1)} раза` : `реже, ${c.lift.toFixed(2)}`}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <p className="font-serif text-sm text-slate-500 mt-1">
                        «Чаще обычного» — доля этого посвящения среди храмов страны против его же доли
                        по всему каталогу. Считать надо именно так: сырое число показало бы, где вообще
                        больше храмов, а не где больше почитают.
                    </p>
                </section>
            )}

            <p className="font-serif">
                <Link className="text-amber-800 hover:underline" href={`/temples?dedication=${params.slug}`}>
                    Все храмы этого посвящения списком
                </Link>
            </p>
        </div>
    );
};

export default DedicationPage;

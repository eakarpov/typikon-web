import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { myFont } from "@/utils/font";
import { setMeta } from "@/lib/meta";
import {
    feastDate, formatFeastDate, getDedication, getTemple, KIND_LABELS,
} from "@/lib/temples";
import { SIGN_LABELS } from "@/utils/chantLabels";
import { countryLabel, JURISDICTIONS, RUSSIAN_CATALOGUE_COUNTRIES } from "@/utils/jurisdictions";
import { lookupLinks } from "@/utils/templeSources";
import TempleMap from "./TempleMap";
import MyTemple from "./MyTemple";

// Карточка храма. Здесь читатель называет свой храм — и с этого места
// «свята́го, его́же есть храм» перестаёт быть пустым пазом службы.

export const generateMetadata = async ({ params }: { params: { slug: string } }): Promise<Metadata> => {
    const temple = await getTemple(params.slug);
    if (!temple) return { title: "Храм не найден" };
    const where = temple.place ? `, ${temple.place}` : "";
    return {
        title: `${temple.name}${where}`,
        description: temple.prestoly?.[0]
            ? `Престол: ${temple.prestoly[0].label}. Престольные праздники и память устава.`
            : "Храм в указателе; престол ещё не разобран.",
    };
};

const TemplePage = async ({ params }: { params: { slug: string } }) => {
    setMeta();
    const temple = await getTemple(params.slug);
    if (!temple) notFound();

    const year = new Date().getUTCFullYear();
    const church = temple.church ? JURISDICTIONS[temple.church] : null;
    // Словарь читает кириллицу, греческое и латинское письмо; албанское или
    // грузинское имя ему пока немо, и молчание его значит не то же самое.
    const knownScript = /[а-яёα-ωa-z]/i.test(temple.name);
    const russianCatalogues = !temple.country || RUSSIAN_CATALOGUE_COUNTRIES.has(temple.country);
    // Праздники берём из словаря, а не из храма: в храме лежит ссылка на
    // посвящение, а даты и памяти — свойство посвящения, одни на все
    // Никольские храмы разом.
    const dedications = await Promise.all(
        (temple.prestoly ?? []).map(async (p) => ({ prestol: p, doc: await getDedication(p.dedication) })));

    return (
        <div className={`pt-2 ${myFont.variable}`}>
            <h1 className="font-serif text-2xl mb-1">{temple.name}</h1>
            <p className="font-serif text-slate-500 mb-1">
                {KIND_LABELS[temple.kind] ?? temple.kind}
                {temple.place && `, ${temple.place}`}
                {temple.country && `, ${countryLabel(temple.country)}`}
                {temple.year && `; построен в ${temple.year}`}
            </p>

            {/* Церковь и устав. Устав у Церквей разный, и служба афинского
                прихода по русскому уставу — это чужая служба. Пока написан
                один устав, и потому здесь важнее сказать, где мы его не
                знаем, чем подставить единственный имеющийся. */}
            {church && (
                <p className="font-serif text-slate-500 mb-4">
                    {church.label}
                    {temple.churchSource === "country" && (
                        <span className="text-sm"> (выведено по стране, не по данным о приходе)</span>
                    )}
                    {church.ustav
                        ? <span className="text-sm">; служба собирается по уставу: {church.ustav}</span>
                        : <span className="text-sm">; устава этой Церкви у нас пока нет — службу не собираем</span>}
                </p>
            )}

            {/* Молчание словаря бывает двух разных родов, и валить их в одну
                подпись нельзя: одно дело — имя не называет престола вовсе,
                другое — называет, но на языке, которого словарь не знает. */}
            {!dedications.length && (
                <p className="font-serif text-slate-600 mb-4">
                    {knownScript
                        ? "Престол этого храма из названия не выводится: имя вроде «Красная церковь» "
                          + "не называет никакого посвящения."
                        : "Престол этого храма не разобран: словарь посвящений пока читает имена "
                          + "по-русски, по-гречески, по-румынски и на сербской латинице."}
                </p>
            )}

            {dedications.map(({ prestol, doc }) => (
                <section key={prestol.dedication} className="mb-6">
                    {/* Придел и престол — одно и то же: в приделе престол один,
                        и «придел такой-то» значит «престол такой-то». Разница
                        между строками здесь только в том, главный он или нет. */}
                    <h2 className="font-serif text-lg">
                        {prestol.isMain ? "Главный престол" : "Престол"}: {prestol.label}
                        {prestol.state === "lost" && (
                            <span className="text-sm text-slate-500"> — утрачен</span>
                        )}
                    </h2>

                    {/* Догадка названа догадкой. Иначе приход не узнает, что
                        поправлять, — а поправить может только он. */}
                    {prestol.status !== "approved" && (
                        <p className="font-serif text-sm text-slate-500">
                            Престол выведен из названия храма и не выверен
                            {prestol.confidence !== undefined && prestol.confidence < 0.6 && ", и уверенности в нём мало"}.
                        </p>
                    )}

                    {!!doc?.feasts?.length && (
                        <>
                            <h3 className="font-serif mt-2">Престольный праздник</h3>
                            <ul className="font-serif">
                                {doc.feasts.map((f, i) => {
                                    const date = feastDate(f, year);
                                    return (
                                        <li key={i}>
                                            {date ? formatFeastDate(date) : "дата не выяснена"}
                                            {f.paschaOffset !== undefined && (
                                                <span className="text-slate-500 text-sm">
                                                    {" "}— день подвижный, считается от Пасхи и каждый год приходится на другое число
                                                </span>
                                            )}
                                            {f.note && <span className="text-slate-500 text-sm"> ({f.note})</span>}
                                            {f.memoryLabel && (
                                                <div className="text-sm text-slate-600">
                                                    {f.memoryLabel}
                                                    {f.sign && ` — ${SIGN_LABELS[f.sign] ?? f.sign}`}
                                                </div>
                                            )}
                                            {!f.memoryId && (
                                                <div className="text-sm text-slate-500">
                                                    Службы этой памяти в собрании нет: поётся из Минеи общей.
                                                </div>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </>
                    )}

                    {!!doc?.saints?.length && (
                        <p className="font-serif mt-2">
                            {doc.saints.map((s) => (
                                <span key={s.dneslovId} className="mr-2">
                                    {s.slug
                                        ? <Link className="text-amber-800 hover:underline" href={`/saints/${s.slug}`}>{s.name}</Link>
                                        : s.name}
                                </span>
                            ))}
                        </p>
                    )}
                </section>
            ))}

            {/* Престолов имя называет не все и почти никогда: в приделе престол
                свой, а приделов у храма бывает три и четыре. К тому же
                утраченный престол остаётся памятью храма, а в открытых данных
                его нет вовсе. Отсылка к частным сводам здесь — не отговорка, а
                единственный честный ответ. */}
            {russianCatalogues && (
            <p className="font-serif text-sm text-slate-500 mb-4">
                Престолы приделов и упразднённые из названия не видны: их знает приход.
                Полнее о престолах этого храма пишут{" "}
                {lookupLinks(temple.name).map((link, i) => (
                    <span key={link.href}>
                        {i > 0 && ", "}
                        <Link className="text-amber-800" href={link.href} target="_blank" rel="noreferrer">
                            {link.label}
                        </Link>
                    </span>
                ))}.
            </p>
            )}

            {/* Расписание — то, зачем на страницу храма приходят чаще всего.
                Показывается всем: оно выводимо из устава и престолов, и ждать
                для этого, чтобы приход сам его завёл, незачем. */}
            <p className="font-serif mt-4">
                <a href={`/parish/${temple.slug}`} className="text-amber-800 hover:underline">
                    Расписание богослужений
                </a>
                <span className="text-slate-500 text-sm">
                    {" "}— проект на месяц, выведенный из устава и престолов этого храма
                </span>
            </p>
            {/* Зовём того, кто может его вести. Показывается всем: кто не из
                этого прихода, тому и предлагать нечего — заявку разберут */}
            <p className="font-serif text-sm text-slate-500">
                <a href={`/parish/${temple.slug}/claim`} className="text-amber-800 hover:underline">
                    Вести расписание этого храма
                </a>
                {" "}— если вы из этого прихода
            </p>

            <MyTemple slug={temple.slug} name={temple.name} />

            <TempleMap latitude={temple.latitude} longitude={temple.longitude} name={temple.name} />

            <p className="font-serif text-sm text-slate-500 mt-4">
                Сведения о храме —{" "}
                {temple.sourceUrl
                    ? (
                        <Link className="text-amber-800" href={temple.sourceUrl} target="_blank" rel="noreferrer">
                            {temple.source === "osm" ? "OpenStreetMap" : "Wikidata"}
                        </Link>
                    )
                    : (temple.source === "osm" ? "OpenStreetMap" : "Wikidata")}
                {temple.source === "osm" ? " (© участники OpenStreetMap, ODbL)" : " (CC0)"}.
            </p>
        </div>
    );
};

export default TemplePage;

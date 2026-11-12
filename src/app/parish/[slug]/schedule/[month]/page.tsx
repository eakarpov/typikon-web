import {nextDayLabel,displayGatheringTitle,normalizeHourText} from "@/lib/parish/serviceDetails";
import type {ServiceMemory} from "@/lib/parish/serviceDetails";
import {EyeIcon} from "@heroicons/react/20/solid";
import {dayOrdoHref} from "@/lib/parish/dayConfig";
import DayTitle from "../DayTitle";
import EditNotices from "./EditNotices";
import MorningLiturgies from "./MorningLiturgies";
import DayEditor from "./DayEditor";
import {schedulePeriod,shiftSchedulePeriod,parishScheduleHref} from "@/lib/parish/period";
import ScheduleTools from "./ScheduleTools";
import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { parishMonth, parishView } from "@/lib/parish/schedule";
import { rightsOn } from "@/lib/parish/access";
import type { Gathering, ParishDay } from "@/lib/parish/types";
import { AddGathering, EditGathering, type DayMarks } from "./Edit";
import { Publish } from "./Publish";

// ПРОЕКТ РАСПИСАНИЯ, который остаётся поправить, а не составить.
//
// Строка здесь — гражданский день, а не церковный: на стенде висит календарь,
// и человек ищет в нём «пятое сентября», а не «неделю двенадцатую по
// Пятидесятнице». Оттого вечернее богослужение шестого числа и стоит в строке
// пятого — там, куда за ним придут.

export const revalidate = 3600;

interface Props {
    params: Promise<{ slug: string; month: string }>;
    searchParams: Promise<{ why?: string; edit?: string }>;
}

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
    const { slug, month } = await params;
    const data = await parishMonth(slug, month);
    if (!data) return { title: "Расписание" };
    return {
        title: `Расписание: ${data.title}, ${data.monthLabel}`,
        description: `Проект расписания богослужений на ${data.monthLabel}, `
            + `выведенный из устава. ${data.title}.`,
    };
};

const WEEKEND = new Set(["суббота", "воскресенье"]);

interface RowProps {
    day: ParishDay; ustav?:string|null; why: boolean; edit: boolean; slug: string; month: string;
}

const Row = ({ day, why, edit, slug, month,ustav }: RowProps) => {
    const marked = Boolean(day.prestolny) || day.dvunadesyaty;
    return (
        <tr style={{
            borderTop: "1px solid #eee",
            background: marked ? "#fdf8ee" : undefined,
        }}>
            <td style={{
                padding: ".5rem .75rem .5rem 0", verticalAlign: "top",
                whiteSpace: "nowrap", width: "1%",
                fontWeight: WEEKEND.has(day.weekdayLabel) ? 600 : 400,
                color: WEEKEND.has(day.weekdayLabel) ? "#8a1c1c" : "#333",
            }}>
                <div style={{ fontSize: "1.05rem" }}>{Number(day.date.slice(8))} <Link className="inline-block no-print print:hidden" href={dayOrdoHref(day,ustav)} title="Последование по выбранному варианту дня" aria-label={`Последование на ${day.date}`}><EyeIcon className="w-4 h-4 text-slate-500"/></Link></div>
                <div style={{ fontSize: ".8rem", color: "#888" }}>{day.weekdayLabel}</div>
            </td>

            <td style={{ padding: ".5rem .75rem .5rem 0", verticalAlign: "top" }}>
                <DayTitle day={day}/>
                {day.prestolny && (
                    <div style={{ color: "#8a6d1c", fontSize: ".85rem" }}>
                        престольный праздник
                    </div>
                )}
                <div style={{ color: "#888", fontSize: ".82rem" }}>
                    {day.fastingLabel??""}
                </div>
                {edit&&<DayEditor key={JSON.stringify(day.dayConfig)??day.date} slug={slug} period={month} day={day}/>}
            </td>

            <td style={{ padding: ".5rem 0", verticalAlign: "top" }}>
                {day.gatherings.length === 0 && (
                    <span style={{ color: "#bbb" }}>—</span>
                )}
                {day.gatherings.filter(g=>!edit||g.part!=='vecher').map(g => (
                    <Item key={g.key} choices={day.memoryChoices??day.memories} g={g} why={why} edit={edit} slug={slug} month={month}
                          marks={{ sign: day.sign, dayVariant: dayVariantOf(day),
                                   weekday: day.weekdayLabel, dvunadesyaty: day.dvunadesyaty,
                                   prestolny: Boolean(day.prestolny), triod: day.triodLabel }} />
                ))}
                {edit&&<MorningLiturgies slug={slug} period={month} day={day}/>}
                {day.gatherings.filter(g=>edit&&g.part==='vecher').map(g => (
                    <Item key={g.key} choices={day.memoryChoices??day.memories} g={g} why={why} edit={edit} slug={slug} month={month}
                          marks={{ sign: day.sign, dayVariant: dayVariantOf(day),
                                   weekday: day.weekdayLabel, dvunadesyaty: day.dvunadesyaty,
                                   prestolny: Boolean(day.prestolny), triod: day.triodLabel }} />
                ))}
                {edit && <AddGathering slug={slug} month={month} date={day.date} choices={day.memoryChoices??day.memories} />}
            </td>
        </tr>
    );
};

// Вариант дня в строке не хранится — он и не нужен читателю; для правила же
// он и есть признак «по всем таким дням», и выводится из подписи дня недели
const dayVariantOf = (d: ParishDay) =>
    d.weekdayLabel === "воскресенье" ? "voskresny"
        : d.weekdayLabel === "суббота" ? "subbotny" : "sedmichny";

const Item = ({ g, why, edit, slug, month, marks,choices }: {
    g: Gathering; why: boolean; edit: boolean; slug: string; month: string;
    marks?: DayMarks;choices?:ServiceMemory[];
}) => (
    <div style={{ marginBottom: ".35rem",
                  opacity: g.cancelled ? .75 : 1 }}>
        <span style={{
            display: "inline-block", minWidth: "3.4rem",
            fontVariantNumeric: "tabular-nums",
            color: g.time ? "#111" : "#bbb",
        }}>
            {g.time ?? "—:—"}
        </span>
        <span style={{ borderBottom: g.edited ? "2px solid #c9a227" : undefined }}>
            {g.cancelled?"Нет богослужения":displayGatheringTitle(g)}
        </span>
        {nextDayLabel(g) && (
            <span style={{ color: "#777" }}> — {nextDayLabel(g)}</span>
        )}
        {/* своё, не попавшее в заголовок: молебен по литургии, крестный ход */}
        {!g.cancelled&&g.services.filter(s => s.own && !displayGatheringTitle(g).includes(normalizeHourText(s.label))).length > 0 && (
            <span style={{ color: "#666" }}>
                {" · "}
                {g.services.filter(s => s.own && !displayGatheringTitle(g).includes(normalizeHourText(s.label)))
                    .map(s => normalizeHourText(s.label)).join(", ")}
            </span>
        )}
        {edit && <EditGathering slug={slug} month={month} g={g} day={marks} choices={choices} />}
        {why && (
            <ul style={{
                margin: ".2rem 0 .5rem 3.4rem", padding: 0, listStyle: "none",
                fontSize: ".8rem", color: "#888",
            }}>
                {g.why.map((w, i) => (
                    <li key={i}>
                        <span style={{ color: "#bbb" }}>
                            {w.kind === "stoyanie" ? "устав" : "приход"}:
                        </span>{" "}
                        {w.text}
                    </li>
                ))}
            </ul>
        )}
    </div>
);

const Page = async ({ params, searchParams }: Props) => {
    const { slug, month } = await params;
    const q = await searchParams;
    const [why, editWanted] = [q.why === "1", q.edit === "1"];
    const rights = await rightsOn(slug);
    const edit = editWanted && rights.canEdit;
    const data = await parishView(slug, month,edit);
    if (!data) notFound();

    // ПРАВО — ИМЕННОЕ И НА ОДИН ХРАМ: ответственный не администратор сайта, и
    // наоборот. Кнопки правки и публикации видит только тот, кто ведёт
    const period=schedulePeriod(month)!;
    const today=new Intl.DateTimeFormat("en-CA",{timeZone:data.timezone,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
    const anchor=today>=period.start&&today<=period.end?today:period.start;

    const stale = data.edits.filter(e => e.status === "stale");
    const orphaned = data.edits.filter(e => e.status === "orphaned");

    return (
        <div style={{ maxWidth: "56rem", margin: "0 auto", padding: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between",
                          alignItems: "baseline", flexWrap: "wrap", gap: ".5rem" }}>
                <h1 style={{ fontSize: "1.4rem", margin: 0 }}>
                    Расписание богослужений
                </h1>
                <div style={{ fontSize: ".9rem" }}>
                    <Link href={parishScheduleHref(slug,shiftSchedulePeriod(month,-1),edit,why)}>← {data.periodType==="week"?"Предыдущая неделя":"Предыдущий месяц"}</Link>
                    {" · "}
                    <Link href={parishScheduleHref(slug,shiftSchedulePeriod(month,1),edit,why)}>{data.periodType==="week"?"Следующая неделя":"Следующий месяц"} →</Link>
                    {" · "}
                    <Link href={`/parish/${slug}/schedule/${month}/print`}>лист на стенд</Link>
                </div>
            </div>
            <p style={{ color: "#666", margin: ".25rem 0 0" }}>
                {data.title} · {data.monthLabel}
            </p>

            {data.civilCalendarAvailable===false&&<p role="status" className="text-sm text-amber-800 mt-2">Производственный календарь временно недоступен. Гражданские выходные пока не учтены; воскресные и отдельные субботние указания действуют.</p>}
            {rights.canEdit&&<ScheduleTools slug={slug} period={month} type={data.periodType} anchor={anchor} why={why} edit={edit} published={!!data.published}/>}

            {data.unavailable ? (
                <p style={{ margin: "2rem 0", color: "#8a1c1c" }}>
                    Служба устава сейчас недоступна, и вывести расписание не из чего.
                </p>
            ) : (
                <>
                    <p style={{ color: "#777", fontSize: ".85rem", margin: ".75rem 0 0" }}>
                        {data.published
                            ? "Расписание храма."
                            : "Проект расписания богослужений."}{" "}
                        <Link href={`/parish/${slug}/schedule/${month}?why=${why ? 0 : 1}&edit=${edit ? 1 : 0}`}>
                            {why ? "скрыть объяснения" : "показать, откуда что взялось"}
                        </Link>

                    </p>

                    {rights.canEdit ? (
                        <Publish periodType={data.periodType} slug={slug} month={month}
                                 published={data.published ? data.published.toISOString() : null}
                                 drifted={data.drifted} />
                    ) : !data.published && (
                        // ЧЕЛОВЕКУ СО СТОРОНЫ СКАЗАНО ПРЯМО, что перед ним:
                        // выведенное нами, а не признанное храмом
                        <p style={{ margin: ".75rem 0 0", padding: ".5rem .75rem",
                                    background: "#f7f7f7", fontSize: ".85rem",
                                    color: "#555" }}>
                            Приход этот лист ещё не утвердил: перед вами проект,
                            выведенный из устава и престолов храма. Уточняйте в храме.
                        </p>
                    )}

                    <EditNotices canEdit={rights.canEdit} slug={slug} stale={stale} orphaned={orphaned}/>

                    {data.failed.length > 0 && (
                        <p style={{ margin: ".75rem 0 0", padding: ".5rem .75rem",
                                    background: "#fdecec", color: "#8a1c1c",
                                    fontSize: ".85rem" }}>
                            Устав не ответил на {data.failed.length} дат
                            ({data.failed.map(d => Number(d.slice(8))).join(", ")}) —
                            этих дней в расписании нет. Пустая строка здесь значила бы
                            «не служим», и потому сказано прямо.
                        </p>
                    )}

                    <table style={{ width: "100%", borderCollapse: "collapse",
                                    marginTop: "1rem", fontSize: ".95rem" }}>
                        <tbody>
                            {data.days.map(d => (
                                <Row key={JSON.stringify(d)} day={d} ustav={data.ustav} why={why} edit={edit}
                                     slug={slug} month={month} />
                            ))}
                        </tbody>
                    </table>

                    <p style={{ marginTop: "1.5rem", fontSize: ".9rem" }}>
                        <a href={`/parish/${slug}/schedule.ics`}>
                            Подписаться календарём
                        </a>
                        <span style={{ color: "#888" }}>
                            {" "}— расписание приедет в телефон и будет обновляться само
                        </span>
                    </p>

                    <p style={{ color: "#999", fontSize: ".8rem", marginTop: ".75rem" }}>
                        Вечернее богослужение стоит в строке того дня, ВЕЧЕРОМ которого
                        служится: церковный день начинается вечером, и вечерня с
                        всенощным принадлежат уже следующему.
                    </p>
                </>
            )}
        </div>
    );
};

export default Page;

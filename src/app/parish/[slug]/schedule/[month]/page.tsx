import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { parishMonth } from "@/lib/parish/schedule";
import type { Gathering, ParishDay } from "@/lib/parish/types";

// ПРОЕКТ РАСПИСАНИЯ, который остаётся поправить, а не составить.
//
// Строка здесь — гражданский день, а не церковный: на стенде висит календарь,
// и человек ищет в нём «пятое сентября», а не «неделю двенадцатую по
// Пятидесятнице». Оттого вечернее богослужение шестого числа и стоит в строке
// пятого — там, куда за ним придут.

export const revalidate = 3600;

interface Props {
    params: Promise<{ slug: string; month: string }>;
    searchParams: Promise<{ why?: string }>;
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

const Row = ({ day, why }: { day: ParishDay; why: boolean }) => {
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
                <div style={{ fontSize: "1.05rem" }}>{Number(day.date.slice(8))}</div>
                <div style={{ fontSize: ".8rem", color: "#888" }}>{day.weekdayLabel}</div>
            </td>

            <td style={{ padding: ".5rem .75rem .5rem 0", verticalAlign: "top" }}>
                <div>{day.triodLabel ?? day.memories[0]?.label ?? day.label}</div>
                {day.prestolny && (
                    <div style={{ color: "#8a6d1c", fontSize: ".85rem" }}>
                        престольный праздник
                    </div>
                )}
                <div style={{ color: "#888", fontSize: ".82rem" }}>
                    {day.label}
                    {day.fastingLabel ? ` · ${day.fastingLabel}` : ""}
                </div>
            </td>

            <td style={{ padding: ".5rem 0", verticalAlign: "top" }}>
                {day.gatherings.length === 0 && (
                    <span style={{ color: "#bbb" }}>—</span>
                )}
                {day.gatherings.map(g => <Item key={g.key} g={g} why={why} />)}
            </td>
        </tr>
    );
};

const Item = ({ g, why }: { g: Gathering; why: boolean }) => (
    <div style={{ marginBottom: ".35rem" }}>
        <span style={{
            display: "inline-block", minWidth: "3.4rem",
            fontVariantNumeric: "tabular-nums",
            color: g.time ? "#111" : "#bbb",
        }}>
            {g.time ?? "—:—"}
        </span>
        <span>{g.title}</span>
        {g.belongsTo && (
            <span style={{ color: "#777" }}> — {g.belongsTo}</span>
        )}
        {/* своё, не попавшее в заголовок: молебен по литургии, крестный ход */}
        {g.services.filter(s => s.own && !g.title.includes(s.label)).length > 0 && (
            <span style={{ color: "#666" }}>
                {" · "}
                {g.services.filter(s => s.own && !g.title.includes(s.label))
                    .map(s => s.label).join(", ")}
            </span>
        )}
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

const monthShift = (month: string, by: number) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + by, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

const Page = async ({ params, searchParams }: Props) => {
    const { slug, month } = await params;
    const why = (await searchParams).why === "1";
    const data = await parishMonth(slug, month);
    if (!data) notFound();

    return (
        <div style={{ maxWidth: "56rem", margin: "0 auto", padding: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between",
                          alignItems: "baseline", flexWrap: "wrap", gap: ".5rem" }}>
                <h1 style={{ fontSize: "1.4rem", margin: 0 }}>
                    Расписание богослужений
                </h1>
                <div style={{ fontSize: ".9rem" }}>
                    <Link href={`/parish/${slug}/schedule/${monthShift(month, -1)}`}>← прошлый</Link>
                    {" · "}
                    <Link href={`/parish/${slug}/schedule/${monthShift(month, 1)}`}>следующий →</Link>
                    {" · "}
                    <Link href={`/parish/${slug}/schedule/${month}/print`}>лист на стенд</Link>
                </div>
            </div>
            <p style={{ color: "#666", margin: ".25rem 0 0" }}>
                {data.title} · {data.monthLabel}
            </p>

            {data.unavailable ? (
                <p style={{ margin: "2rem 0", color: "#8a1c1c" }}>
                    Служба устава сейчас недоступна, и вывести расписание не из чего.
                </p>
            ) : (
                <>
                    <p style={{ color: "#777", fontSize: ".85rem", margin: ".75rem 0 0" }}>
                        Это ПРОЕКТ, выведенный из устава: что служится — сказал устав, во
                        сколько — приходское умолчание.{" "}
                        <Link href={`/parish/${slug}/schedule/${month}${why ? "" : "?why=1"}`}>
                            {why ? "скрыть объяснения" : "показать, откуда что взялось"}
                        </Link>
                    </p>

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
                            {data.days.map(d => <Row key={d.date} day={d} why={why} />)}
                        </tbody>
                    </table>

                    <p style={{ color: "#999", fontSize: ".8rem", marginTop: "1.5rem" }}>
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

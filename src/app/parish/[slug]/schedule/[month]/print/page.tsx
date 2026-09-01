import { Metadata } from "next";
import { notFound } from "next/navigation";
import { parishView } from "@/lib/parish/schedule";
import type { ParishDay } from "@/lib/parish/types";

// ЛИСТОВКА НА СТЕНД — то самое изделие, ради которого всё и делалось.
//
// Печатается браузером, а не собирается в PDF: у настоятеля уже есть принтер и
// кнопка «печать», а у нас — вёрстка, которую он видит на экране ровно такой,
// какой она ляжет на бумагу. Своя сборка PDF понадобится, когда лист начнут
// рассылать ссылкой, а не вешать.
//
// Плотность здесь важнее красоты: месяц должен уместиться на один лист, иначе
// на стенде окажутся два, и второй потеряется.

export const revalidate = 3600;

interface Props {
    params: Promise<{ slug: string; month: string }>;
}

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
    const { slug, month } = await params;
    const data = await parishView(slug, month);
    return {
        title: data ? `${data.title} — ${data.monthLabel}` : "Расписание",
        robots: { index: false },
    };
};

const CSS = `
@page { size: A4 portrait; margin: 12mm 10mm; }
@media print {
  nav, .no-print { display: none !important; }
  .container { padding: 0 !important; max-width: none !important; }
  .sheet { font-size: 8.6pt; }
  .day { break-inside: avoid; }
}
.sheet { font-family: Georgia, "Times New Roman", serif; color: #111;
         max-width: 190mm; margin: 0 auto; }
.sheet h1 { font-size: 1.5em; text-align: center; margin: 0 0 .1em; font-weight: normal; }
.sheet .sub { text-align: center; color: #444; margin: 0 0 1em; }
.day { display: grid; grid-template-columns: 3.2em 1fr 15.5em; gap: .5em;
       padding: .28em 0; border-top: 1px solid #ddd; align-items: baseline; }
.day.mark { background: #faf3e4; }
.num { font-size: 1.15em; text-align: right; }
.num .wd { display: block; font-size: .62em; color: #666; }
.what { line-height: 1.25; }
.what .sub { font-size: .8em; color: #555; margin: 0; text-align: left; }
.when { line-height: 1.3; }
/* НИЧЕГО НЕ ОБРЕЗАЕТСЯ. Многоточие вместо конца строки — потеря: лист висит
   на стене, и дочитать его негде. Длинное имя переносится с отступом под
   время, чтобы столбец времени оставался ровным */
.when div { padding-left: 3.1em; text-indent: -3.1em; }
.when b { font-weight: normal; font-variant-numeric: tabular-nums;
          display: inline-block; min-width: 3.1em; text-indent: 0; }
.foot { margin-top: .9em; font-size: .78em; color: #555; text-align: center; }
`;

const RED = new Set(["суббота", "воскресенье"]);

// Постовая помета на листовке — короткая. Движок отдаёт полную, вплоть до
// расхождения глав Типикона («по гл. 32 — сухоядение; по гл. 35 — поста нет»),
// и это правильно на карточке дня, где спорят о уставе. На стенде спорить
// некому: там нужна степень поста, а не её обоснование.
// НА СТЕНДЕ ИМЕНА КОРОЧЕ. Не ради красоты: «Литургия Преждеосвященных Даров»
// занимает на листе три строки, и месяц Великого поста перестаёт умещаться на
// один лист — а второй со стенда теряется. Сокращения взяты те, которыми и
// пишут в приходских расписаниях, а не выдуманы.
const SHORT: [RegExp, string][] = [
    [/^Литургия Преждеосвященных Даров$/, "Литургия Преждеосвященных"],
    [/^Утреня с чтением двенадцати Страстных Евангелий$/, "Утреня. 12 Евангелий"],
    [/^Полунощница\. Крестный ход\. Пасхальная заутреня и Литургия$/,
     "Пасхальная полунощница, заутреня и Литургия"],
    [/^Утреня с чином погребения$/, "Утреня. Погребение Плащаницы"],
];

const shortTitle = (title: string): string => {
    for (const [re, to] of SHORT) if (re.test(title)) return to;
    return title;
};

const shortFast = (label: string | null): string => {
    if (!label) return "";
    const body = label.includes(":") ? label.slice(label.indexOf(":") + 1) : label;
    const first = body.split(";")[0].trim();
    return first.length > 46 ? `${first.slice(0, 45)}…` : first;
};

const Day = ({ d }: { d: ParishDay }) => (
    <div className={`day${d.prestolny || d.dvunadesyaty ? " mark" : ""}`}>
        <div className="num" style={{ color: RED.has(d.weekdayLabel) ? "#8a1c1c" : undefined }}>
            {Number(d.date.slice(8))}
            <span className="wd">{d.weekdayLabel.slice(0, 2)}</span>
        </div>
        <div className="what">
            <div>{d.triodLabel ?? d.memories[0]?.label ?? d.label}</div>
            <p className="sub">
                {d.prestolny ? "престольный праздник · " : ""}
                {shortFast(d.fastingLabel)}
            </p>
        </div>
        <div className="when">
            {d.gatherings.length === 0 ? <div>&nbsp;</div> : d.gatherings.map(g => (
                <div key={g.key} title={g.title}>
                    <b>{g.time ?? "—"}</b>{shortTitle(g.title)}
                </div>
            ))}
        </div>
    </div>
);

const Page = async ({ params }: Props) => {
    const { slug, month } = await params;
    const data = await parishView(slug, month);
    if (!data) notFound();

    return (
        <>
            <style dangerouslySetInnerHTML={{ __html: CSS }} />
            <p className="no-print" style={{ margin: "1rem 0", color: "#666" }}>
                Лист для стенда: печатайте прямо отсюда. Вся разметка сайта при
                печати скрывается.
            </p>
            <div className="sheet">
                <h1>Расписание богослужений</h1>
                <p className="sub">{data.title} · {data.monthLabel}</p>
                {data.failed.length > 0 && (
                    <p className="sub" style={{ color: "#8a1c1c" }}>
                        Нет данных на числа: {data.failed.map(d => Number(d.slice(8))).join(", ")}
                    </p>
                )}
                {data.days.map(d => <Day key={d.date} d={d} />)}
                <p className="foot">
                    Вечернее богослужение указано в тот день, вечером которого
                    служится. Расписание может измениться — уточняйте в храме.
                </p>
            </div>
        </>
    );
};

export default Page;

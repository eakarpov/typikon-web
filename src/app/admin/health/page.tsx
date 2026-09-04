import Link from "next/link";
import { requires } from "@/lib/admin";
import { myFont } from "@/utils/font";
import { collectHealth } from "@/lib/health/collect";
import { changeSince, gapShare, severityOf, type HealthSnapshot, type Metric, type MetricGroup } from "@/lib/health/core";
import { lastSnapshot } from "@/lib/health/store";

// Панель здоровья собрания: перечень того, что не доделано, числами.
//
// ЗАКРЫТА, ПОКА ЗАКРЫТА. Замысел был открытым разделом — «показывать свои дыры
// дешевле, чем объяснять их потом», — и им ещё станет. Но открытая страница
// обязана быть выверенной: всякое число на ней читатель примет за суждение
// о собрании, а половина здешних строк — вопросы к самим себе («правда ли
// книга без цитат молчит, или это сличитель не дотянулся»). Сперва их надо
// пересмотреть глазами, а до тех пор место панели — в админке.
//
// Просит `content`: это перечень работы над содержимым, и открыт он тому, кто
// содержимое правит. Модератору приходов здесь делать нечего.

export const dynamic = "force-dynamic";

const n = (value: number) => value.toLocaleString("ru-RU");

const BAR: Record<string, string> = {
    high: "bg-red-900",
    mid: "bg-amber-700",
    low: "bg-slate-400",
};

const Row = ({ metric, previous }: { metric: Metric; previous: HealthSnapshot | null }) => {
    const share = gapShare(metric);
    const severity = severityOf(metric);
    const change = changeSince(metric, previous);

    return (
        <li className="border-l-2 border-slate-200 pl-3 py-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-serif text-slate-800">{metric.label}</span>
                <span className="font-serif font-bold">{n(metric.gap)}</span>
                {metric.total !== null && (
                    <span className="text-xs text-slate-500 font-serif">
                        из {n(metric.total)}
                        {/* Две цитаты из семи с половиной тысяч — это не «0 %»: круглый
                            ноль рядом с ненулевым числом читается как ошибка счёта. */}
                        {share !== null && (
                            <> · {share < 0.1 && metric.gap > 0 ? "менее 0,1" : share.toLocaleString("ru-RU")}%</>
                        )}
                    </span>
                )}
                {metric.observation && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-serif">
                        наблюдение
                    </span>
                )}
                {metric.manual && (
                    // Помета не украшение: она отделяет работу, которую можно
                    // сделать кодом, от работы, которую делают глазами и книгой.
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-serif">
                        руками
                    </span>
                )}
                {!!change && (
                    // Плюс значит «стало хуже»: страница считает недостачи, и
                    // обратный знак пришлось бы читать через отрицание.
                    <span
                        className={`text-xs font-serif ${change > 0 ? "text-amber-700" : "text-emerald-700"}`}
                        title="изменение с прошлого снимка"
                    >
                        {change > 0 ? "+" : "−"}{n(Math.abs(change))}
                    </span>
                )}
                {metric.href && (
                    <Link href={metric.href} className="text-xs text-red-900 font-serif hover:underline">
                        смотреть →
                    </Link>
                )}
            </div>

            {share !== null && (
                <div className="h-1 bg-slate-100 mt-1 max-w-md" role="presentation">
                    <div className={`h-1 ${BAR[severity]}`} style={{ width: `${Math.min(100, share)}%` }} />
                </div>
            )}

            <p className="text-xs text-slate-500 font-serif mt-1 max-w-2xl">{metric.note}</p>
        </li>
    );
};

const Group = ({ group, previous }: { group: MetricGroup; previous: HealthSnapshot | null }) => (
    <section>
        <h2 className="font-serif font-bold text-sm">{group.title}</h2>
        <p className="text-xs text-slate-400 font-serif">{group.source}</p>
        {group.unavailable && (
            <p className="text-xs text-amber-700 font-serif mt-1 max-w-2xl">{group.unavailable}</p>
        )}
        {group.metrics.length > 0 && (
            <ul className="mt-2 flex flex-col gap-2">
                {group.metrics.map((metric) => (
                    <Row key={metric.id} metric={metric} previous={previous} />
                ))}
            </ul>
        )}
    </section>
);

const Health = async () => {
    const [report, previous] = await Promise.all([collectHealth(), lastSnapshot()]);

    return (
        <div className={`${myFont.variable} p-4 flex flex-col gap-6`}>
            <div>
                <h1 className="font-bold font-serif">Здоровье собрания</h1>
                <p className="font-serif text-slate-800 mt-2 max-w-2xl">
                    Чего в собрании недостаёт — перечислимо и с числами. Всякая строка здесь это
                    недостача, а не охват: страницу открывают, чтобы найти работу, и сделанное
                    на ней никому не нужно.
                </p>
                <p className="font-serif text-slate-600 text-sm mt-2 max-w-2xl">
                    Числа снимаются запросами при каждом заходе, а не пересказываются из ROADMAP:
                    панель, отставшая от собрания, врала бы ровно там, где нужнее всего правда.
                    Оттого страница и думает пару секунд.
                </p>
            </div>

            {report.groups.map((group) => (
                <Group key={group.id} group={group} previous={previous} />
            ))}

            <p className="text-xs text-slate-400 font-serif">
                Снято {new Date(report.generatedAt).toLocaleString("ru-RU")}.{" "}
                {previous
                    ? <>Изменения — против снимка
                        от {new Date(previous.takenAt).toLocaleDateString("ru-RU")};
                        новый снимает <code>npm run health:snapshot -- --write</code>.{" "}</>
                    : <>Снимков ещё не делали, поэтому сравнивать не с чем:
                        первый снимает <code>npm run health:snapshot -- --write</code>.{" "}</>}
                Помета «руками»
                значит, что закрывается это разбором книг, а не правкой в админке, — и потому
                годится в очередь задач для тех, кто знает предмет.
            </p>
        </div>
    );
};

export default requires("content", Health);

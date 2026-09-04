import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { myFont } from "@/utils/font";
import { MONTH_LABELS, MONTH_OF } from "@/utils/chantLabels";
import { parseSegment } from "@/lib/trapeza/core";
import Day from "@/app/trapeza/[date]/Day";
import Month from "@/app/trapeza/[date]/Month";

// Трапеза по Типикону: что книга назначает на этот день и чем это сказано.
//
// ОДИН СЕГМЕНТ НА ДВА ВИДА: «2026-09-04» — день, «2026-09» — месяц. Разводить
// их по разным путям («/trapeza/mesyats/2026-09») значило бы завести второе
// имя тому же разделу; вид читается по самой дате, и ошибиться в нём нельзя.
//
// Час кэша — у выборки (см. lib/trapeza/store), а не у страницы: ответ на дату
// не зависит ни от читателя, ни от его настроек, и держать его динамическим
// незачем.

const title = (raw: string) => {
    const seg = parseSegment(raw);
    if (!seg) return "Трапеза — Уставные чтения";
    if (seg.kind === "month") {
        return `Трапеза: ${MONTH_LABELS[seg.month]} ${seg.year} — Уставные чтения`;
    }
    const [y, m, d] = seg.date.split("-").map(Number);
    return `Трапеза: ${d} ${MONTH_OF[m]} ${y} — Уставные чтения`;
};

export async function generateMetadata({ params }: { params: { date: string } }): Promise<Metadata> {
    return {
        title: title(params.date),
        // ВЕРДИКТА В ОПИСАНИИ НЕТ НАРОЧНО. Сниппет в поисковой выдаче оговорку
        // не унесёт, а «елей и вино» без оговорки читается предписанием — тем
        // самым, каким эта страница быть не должна.
        description: "Что Типикон назначает на трапезу в этот день: правило, глава и цитата. "
            + "Устав монастырский.",
    };
}

const TrapezaDate = ({ params }: { params: { date: string } }) => {
    const segment = parseSegment(params.date);
    if (!segment) notFound();

    return (
        <div className={`${myFont.variable} pt-2`}>
            {segment.kind === "day"
                ? <Day date={segment.date} />
                : <Month year={segment.year} month={segment.month} />}
        </div>
    );
};

export default TrapezaDate;

import { ordoDayPackage, ordoViewRules } from "@/lib/ordoPackage";
import type { ParsedService } from "@/lib/ordoPackageReader";
import type { OrdoDay, OrdoTransfer } from "@/lib/ordo";
import { MONTH_OF } from "@/utils/chantLabels";
import ServiceLoader from "./ServiceLoader";

// Суточный круг одним пакетом. Страница ждёт день и шапку сразу, а здесь —
// один запрос к службе устава: день-пакет .ordo (internal: все тексты и
// указания) плюс таблицы подач. Поштучных запросов больше нет: движок собирает
// день одним вызовом, и резать его на части ради видимости прогресса
// значило бы платить сборкой дважды.
//
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

export interface ServicesCommon {
    ustav?: string;
    variant?: string;
    transfers: OrdoTransfer[];
    lang?: string;
    parallel?: string;
    psalms?: string;
}

const ServicesBlock = async ({ day, common, razdelno }: {
    day: OrdoDay;
    common: ServicesCommon;
    razdelno: boolean;
}) => {
    const [pkg, rules] = await Promise.all([
        ordoDayPackage({
            date: day.date,
            ustav: common.ustav,
            variant: common.variant,
            lang: common.lang,
            parallel: common.parallel,
            psalms: common.psalms,
            transfers: common.transfers,
        }),
        ordoViewRules(),
    ]);

    const why = pkg.error ?? (rules ? null : "таблицы подач не пришли");
    if (!pkg.data || !rules) {
        return (
            <div className="font-serif text-slate-500 py-2">
                Последование не собралось: {why ?? "пустой ответ"}.
            </div>
        );
    }

    const variant = day.variants.find(v => v.key === common.variant) ?? day.variants[0];
    if (!variant) {
        return <p className="font-serif text-slate-600">Уставу нечего предложить на этот день.</p>;
    }

    const byKey = new Map(pkg.data.services.map((s): [string, ParsedService] => [s.key, s]));
    return (
        <>
            {[...variant.stoyaniya].sort(byClock).map(st => {
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
                            {services.map(s => {
                                const data = byKey.get(s.key);
                                return (
                                    <div key={s.key}>
                                        {data
                                            ? <ServiceLoader data={data} rules={rules} />
                                            : <div className="font-serif text-slate-500 py-2">
                                                  <span className="text-slate-700">{s.label}</span> — не собралась: службы нет в пакете.
                                              </div>}
                                        <DownloadLink date={day.date} service={s.key} common={common} razdelno={razdelno} />
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                );
            })}
        </>
    );
};

// Ссылку рисует серверная часть, поэтому скачивание не ждёт сборки службы
// и не падает вместе с ней.
const DownloadLink = ({ date, service, common, razdelno }: {
    date: string;
    service: string;
    common: ServicesCommon;
    razdelno: boolean;
}) => {
    const q = new URLSearchParams({ date, service });
    if (common.variant) q.set("variant", common.variant);
    if (common.ustav) q.set("ustav", common.ustav);
    if (razdelno) q.set("bdenie", "0");
    return (
        <a download href={`/api/ordo/package?${q.toString()}`}
           className="text-[11px] font-serif text-slate-400 underline underline-offset-2">
            скачать .ordo
        </a>
    );
};

export default ServicesBlock;

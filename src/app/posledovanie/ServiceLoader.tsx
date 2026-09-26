import { ordoPackage, ordoUkazaniya, ordoViewRules } from "@/lib/ordoPackage";
import type { OrdoSutkiQuery } from "@/lib/ordo";
import ServiceView, { type Served } from "./ServiceView";

// Одна служба суток — свой запрос в своём Suspense: пока собирается бдение,
// повечерие и часы уже на странице. Служба читается из пакета .ordo (spec/
// package.md в typikon-rules) — того же формата, что уходит наружу, а не из
// параллельной JSON-выдачи. Указания и таблицы подач идут отдельными ручками:
// в пакет они не входят (указания — рассказ о службе, а не канва; подачу
// выбирает читатель).
//
// Не собралась — говорим ПОЧЕМУ, словами службы устава: «не ответила» без
// причины не отличает отменённую службу от упавшей сборки и от оборванного
// соединения, а чинить их приходится по-разному.
const ServiceLoader = async ({ query, label, placementWhy }: {
    query: OrdoSutkiQuery;
    label: string;
    placementWhy: string | null;
}) => {
    const key = query.services?.[0];
    if (!key) return <Failed label={label} why="служба не названа" />;

    const [pkg, rules, ukaz] = await Promise.all([
        ordoPackage({
            date: query.date,
            ustav: query.ustav,
            variant: query.variant,
            service: key,
            lang: query.lang,
            parallel: query.parallel,
            psalms: query.psalms,
            transfers: query.transfers,
        }),
        ordoViewRules(),
        ordoUkazaniya({ date: query.date, service: key, ustav: query.ustav, variant: query.variant }),
    ]);

    const why = pkg.error ?? (rules ? null : "таблицы подач не пришли") ?? ukaz.error;
    if (!pkg.data || !rules || !ukaz.data) {
        return <Failed label={label} why={why ?? "пустой ответ"} />;
    }

    const service: Served = {
        label,
        feastLabel: pkg.data.feastLabel,
        placementWhy,
        steps: pkg.data.steps,
        ukazaniya: ukaz.data,
        rules: pkg.data.rules,
    };
    return <ServiceView service={service} rules={rules} />;
};

const Failed = ({ label, why }: { label: string; why: string }) => (
    <div className="font-serif text-slate-500 py-2">
        <span className="text-slate-700">{label}</span> — не собралась: {why}.
    </div>
);

export default ServiceLoader;

import { ordoSutki, type OrdoSutkiQuery } from "@/lib/ordo";
import ServiceView from "./ServiceView";

// Одна служба суток — свой запрос в своём Suspense: пока собирается бдение,
// повечерие и часы уже на странице.
//
// Не собралась — говорим ПОЧЕМУ, словами службы устава: «не ответила» без
// причины не отличает отменённую службу от упавшей сборки и от оборванного
// соединения, а чинить их приходится по-разному.
const ServiceLoader = async ({ query, label }: { query: OrdoSutkiQuery; label: string }) => {
    const sutki = await ordoSutki(query);
    if ("error" in sutki) return <Failed label={label} why={sutki.error} />;
    const service = sutki.services[0];
    if (!service || service.error) {
        return <Failed label={label} why={service?.error ?? "служба не вернулась в ответе"} />;
    }
    return <ServiceView service={service} rules={sutki.viewRules} />;
};

const Failed = ({ label, why }: { label: string; why: string }) => (
    <div className="font-serif text-slate-500 py-2">
        <span className="text-slate-700">{label}</span> — не собралась: {why}.
    </div>
);

export default ServiceLoader;

import { ordoSutki, type OrdoSutkiQuery } from "@/lib/ordo";
import ServiceView from "./ServiceView";

// Одна служба суток — свой запрос в своём Suspense: пока собирается бдение,
// повечерие и часы уже на странице.
const ServiceLoader = async ({ query, label }: { query: OrdoSutkiQuery; label: string }) => {
    const sutki = await ordoSutki(query);
    const service = sutki?.services[0];
    if (!sutki || !service || service.error) {
        return (
            <div className="font-serif text-slate-500 py-2">
                <span className="text-slate-700">{label}</span> — не собралась
                {service?.error ? `: ${service.error}` : ": служба устава не ответила"}.
            </div>
        );
    }
    return <ServiceView service={service} rules={sutki.viewRules} />;
};

export default ServiceLoader;

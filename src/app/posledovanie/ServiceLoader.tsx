import type { ParsedService } from "@/lib/ordoPackageReader";
import type { OrdoViewRules } from "@/lib/ordo";
import ServiceView, { type Served } from "./ServiceView";

// Служба из день-пакета — чистый показ: данные пришли из пакета (.ordo,
// spec/package.md в typikon-rules), сеть здесь не нужна. Не собралась —
// говорим ПОЧЕМУ словами службы: причина ехала в пакете с самой службой.
const ServiceLoader = ({ data, rules }: { data: ParsedService; rules: OrdoViewRules }) => {
    if (data.error) {
        return (
            <div className="font-serif text-slate-500 py-2">
                <span className="text-slate-700">{data.label ?? data.key}</span> — не собралась: {data.error}.
            </div>
        );
    }
    const service: Served = {
        label: data.label ?? data.key,
        feastLabel: data.feastLabel,
        placementWhy: data.placementWhy,
        steps: data.steps,
        ukazaniya: data.ukazaniya ?? [],
        rules: data.rules,
    };
    return <ServiceView service={service} rules={rules} />;
};

export default ServiceLoader;

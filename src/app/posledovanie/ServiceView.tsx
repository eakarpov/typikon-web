'use client';
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import type { OrdoRule, OrdoStep, OrdoUkazParagraph, OrdoViewRules } from "@/lib/ordo";
import { applyView, UKAZANIYA } from "@/lib/ordoView";
import Ladder from "@/app/components/ordo/Ladder";
import Steps from "@/app/components/ordo/Steps";
import Ukazaniya from "./Ukazaniya";
import { VIEW_PARAM } from "./params";

// Служба в выбранной подаче: что показывать, решает ServiceLoader (пакет .ordo
// плюс таблицы подач), здесь — только выбор подачи. Подача читается из адреса
// и меняется без запроса к серверу: шаги уже здесь, нейтральные.
export interface Served {
    label: string;
    feastLabel: string | null;
    placementWhy: string | null;
    steps: OrdoStep[];
    ukazaniya: OrdoUkazParagraph[];
    rules: OrdoRule[];
}

const ServiceView = ({ service, rules }: { service: Served; rules: OrdoViewRules }) => {
    const view = useSearchParams()?.get(VIEW_PARAM) || UKAZANIYA;
    const steps = useMemo(
        () => view === UKAZANIYA ? [] : applyView(service.steps, view, rules),
        [service.steps, view, rules],
    );

    return (
        <details open className="group">
            <summary className="cursor-pointer font-serif text-base py-1 list-none">
                <span className="text-slate-400 mr-1 group-open:rotate-90 inline-block transition-transform">›</span>
                <span className="text-slate-800">{service.label}</span>
                {service.feastLabel && (
                    <span className="text-sm text-slate-500"> — {service.feastLabel}</span>
                )}
            </summary>
            {service.placementWhy && (
                <p className="font-serif text-xs text-slate-500 mb-1">{service.placementWhy}</p>
            )}
            <div className="pl-3 border-l border-slate-100">
                {view === UKAZANIYA
                    ? <Ukazaniya paragraphs={service.ukazaniya} />
                    : <Steps steps={steps} />}
                <details className="mt-3 mb-2">
                    <summary className="cursor-pointer text-xs text-slate-500 font-serif">
                        Правила, сложившие эту службу
                    </summary>
                    <div className="mt-1"><Ladder rules={service.rules} /></div>
                </details>
            </div>
        </details>
    );
};

export default ServiceView;

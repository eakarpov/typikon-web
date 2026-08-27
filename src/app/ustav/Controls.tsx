'use client';
import React, { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { OrdoOptions, OrdoService } from "@/lib/ordo";
import { MONTH_LABELS } from "@/utils/chantLabels";

// Чем задаётся вопрос к уставу. Состояние держим в адресе страницы, а не в
// компоненте: собранную службу тогда можно переслать ссылкой, и «назад»
// возвращает к прежнему дню, а не к пустой форме.

interface Props {
    services: OrdoService[];
    options: OrdoOptions | null;
    params: Record<string, string | undefined>;
}

const SELECT = "border rounded px-1 py-0.5 text-sm font-serif bg-white";

const Controls = ({ services, options, params }: Props) => {
    const router = useRouter();
    const pathname = usePathname();

    const push = useCallback((changes: Record<string, string>) => {
        const next = new URLSearchParams();
        for (const [k, v] of Object.entries(params)) if (v) next.set(k, v);
        for (const [k, v] of Object.entries(changes)) {
            if (v) next.set(k, v); else next.delete(k);
        }
        router.push(`${pathname}?${next.toString()}`);
    }, [params, pathname, router]);

    const select = (name: string, empty: string | null,
                    options: { key: string | number; label: string }[]) => (
        <select className={SELECT} value={params[name] || ""}
                onChange={e => push({ [name]: e.target.value })}>
            {empty !== null && <option value="">{empty}</option>}
            {options.map(o => (
                <option key={o.key} value={String(o.key)}>{o.label}</option>
            ))}
        </select>
    );

    const days = Array.from({ length: 31 }, (_, i) => ({ key: i + 1, label: String(i + 1) }));
    const months = MONTH_LABELS.slice(1).map((label, i) => ({ key: i + 1, label }));
    const prihod = options?.prihods.find(p => p.prihod === params.prihod);

    return (
        <div className="flex flex-col gap-2 mb-4">
            <div className="flex flex-wrap gap-2 items-baseline">
                {select("ordo", null, services.map(s => ({ key: s.ordoId, label: s.label })))}
                {select("day", null, days)}
                {select("month", null, months)}
            </div>

            {options && (
                <>
                    <div className="flex flex-wrap gap-2 items-baseline">
                        {select("sign", "— без устава (показать всё) —",
                            options.signs.map(s => ({ key: s.key, label: s.label })))}
                        {select("day_variant", null,
                            options.dayVariants.map(s => ({ key: s.key, label: s.label })))}
                        {select("feast", "— по дню —", [
                            ...options.feasts.map(s => ({ key: s.key, label: s.label })),
                            // Слой праздника определяется по самому дню; этот
                            // пункт нужен, чтобы сказать «а сегодня не праздник»
                            // и увидеть службу без него.
                            { key: options.feastNone, label: "— не праздничный день —" },
                        ])}
                    </div>
                    <div className="flex flex-wrap gap-2 items-baseline">
                        {select("predstoyatel", null,
                            options.predstoyatel.map(s => ({ key: s.key, label: s.label })))}
                        {select("lang", null,
                            options.languages.map(s => ({ key: s.key, label: s.label })))}
                        {select("view", null,
                            Object.entries(options.views).map(([key, label]) => ({ key, label })))}
                        {select("prihod", "— без прихода —",
                            options.prihods.map(p => ({ key: p.prihod, label: p.prihod })))}
                        {prihod && select("prestol", "— главный —",
                            prihod.prestoly.map(p => ({
                                key: p.key,
                                label: p.label.slice(0, 46) + (p.isMain ? " (главный)" : ""),
                            })))}
                    </div>
                    <div className="flex flex-wrap gap-4 items-baseline text-sm font-serif">
                        <label className="flex gap-1 items-baseline">
                            <input type="checkbox" checked={params.psalms === "1"}
                                   onChange={e => push({ psalms: e.target.checked ? "1" : "" })} />
                            тексты псалмов
                        </label>
                        <label className="flex gap-1 items-baseline">
                            <input type="checkbox" checked={params.bez_diakona === "1"}
                                   onChange={e => push({ bez_diakona: e.target.checked ? "1" : "" })} />
                            без диакона
                        </label>
                    </div>
                </>
            )}
        </div>
    );
};

export default Controls;

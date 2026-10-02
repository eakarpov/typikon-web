'use client';
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { parsePackage, scriptureRefs, type ParsedPackage, type ParsedService } from "@/lib/ordoPackageReader";
import { UKAZANIYA, viewChoices } from "@/lib/ordoView";
import type { OrdoStep, OrdoViewRules } from "@/lib/ordo";
import ServiceView, { type Served } from "./ServiceView";

// Режим загруженного пакета. Оборачивает дневную колонку /posledovanie:
// обычно пропускает день насквозь и держит плашку «Открыть пакет…», а когда
// файл выбран — читает его в браузере и показывает ВМЕСТО дня. Чтение
// клиентское намеренно: пакет везли ради «поездки без сети», и просить для
// просмотра сервер значило бы сломать это обещание.
//
// Состав честно показываем через манифест: какие тела легли, что молчит и
// по какой причине, применялись ли ворота прав. Внутренний пакет
// (gates: "none") не блокируем — владелец может открыть свой же файл, —
// но называем его внутренним. Писание пакет адресует (external), а не
// везёт: онлайн мы дорезолвляем его эталонным резолвером сайта
// (/api/ordo/scripture), офлайн честно показываем слово о молчании.
const FALLBACK_RULES: OrdoViewRules = {
    views: { full: "полное последование" },
    roleAliases: {}, roleViews: {}, readPositions: [], defaultRole: {}, notebooks: [],
};

const MAX_BYTES = 20 * 1024 * 1024;

const COUNT_LABEL: Record<string, string> = {
    "rights": "право не выяснено",
    "not-collected": "в корпусе нет текста",
    "external": "Писание — адресами",
    "omitted": "тел не просили",
    "unset": "место без настройки",
};

const Failed = ({ label, why }: { label: string; why: string }) => (
    <div className="font-serif text-slate-500 py-2">
        <span className="text-slate-700">{label}</span> — не собралась: {why}.
    </div>
);

const Loaded = ({ name, parsed, onClose }: { name: string; parsed: ParsedPackage; onClose: () => void }) => {
    const [rules, setRules] = useState<OrdoViewRules | null>(null);
    const [rulesMissing, setRulesMissing] = useState(false);
    const hasUkazaniya = parsed.services.some(s => (s.ukazaniya?.length ?? 0) > 0);
    const [view, setView] = useState(hasUkazaniya ? UKAZANIYA : "full");
    const [resolved, setResolved] = useState<Record<string, string>>({});
    const [resolveNote, setResolveNote] = useState<string | null>(null);

    useEffect(() => {
        fetch("/api/ordo/view-rules")
            .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
            .then((r: OrdoViewRules) => setRules(r))
            .catch(() => setRulesMissing(true));
    }, []);

    useEffect(() => {
        const refs = scriptureRefs(parsed.services);
        if (!refs.length) return;
        let alive = true;
        Promise.all(refs.map(async (ref): Promise<readonly [string, string | null]> => {
            try {
                const r = await fetch(`/api/ordo/scripture?ref=${encodeURIComponent(ref)}`);
                if (!r.ok) return [ref, null] as const;
                const j = await r.json();
                return [ref, typeof j.text === "string" ? j.text : null] as const;
            } catch {
                return [ref, null] as const;
            }
        })).then(results => {
            if (!alive) return;
            const map: Record<string, string> = {};
            let missed = 0;
            for (const [ref, text] of results) {
                if (text) map[ref] = text;
                else missed++;
            }
            setResolved(map);
            if (missed) setResolveNote(`Писание не дорезолвлено: ${missed} адрес(ов) без ответа.`);
        });
        return () => { alive = false; };
    }, [parsed]);

    const manifest = parsed.manifest ?? {};
    const scope = manifest.scope ?? {};
    const counts = manifest.body_counts ?? {};
    const applied = rules ?? FALLBACK_RULES;
    const choices = viewChoices(applied).filter(c => hasUkazaniya || c.key !== UKAZANIYA);
    // выбранная подача может исчезнуть (таблицы не доехали): тогда на полное
    const effectiveView = choices.some(c => c.key === view) ? view : (hasUkazaniya ? UKAZANIYA : "full");

    const patchSteps = (steps: OrdoStep[]): OrdoStep[] =>
        steps.map(step => ({
            ...step,
            items: (step.items ?? []).map((it: any) =>
                it?.absent === "external" && typeof it.address === "string"
                    && it.address.startsWith("bible:") && resolved[it.address]
                    ? { ...it, text: resolved[it.address] }
                    : it),
        }));

    const servedOf = (s: ParsedService): Served => ({
        label: s.label ?? s.key,
        feastLabel: s.feastLabel,
        placementWhy: s.placementWhy,
        steps: patchSteps(s.steps),
        ukazaniya: s.ukazaniya ?? [],
        rules: s.rules,
    });

    const silent = Object.entries(counts)
        .filter(([k, v]) => k !== "present" && typeof v === "number" && v > 0)
        .map(([k, v]) => `${COUNT_LABEL[k] ?? k} — ${v}`);
    const externalCount = counts["external"] ?? 0;
    const resolvedCount = Object.keys(resolved).length;

    return (
        <section className="mt-6">
            <div className="flex items-baseline gap-3 flex-wrap">
                <h2 className="font-serif text-lg text-red-900">Открыт пакет: {name}</h2>
                <button onClick={onClose}
                        className="text-xs font-serif text-slate-500 underline underline-offset-2">
                    вернуться к дню
                </button>
            </div>
            <p className="font-serif text-xs text-slate-500 mt-1">
                {scope.date && <span className="mr-2">{scope.date}</span>}
                {scope.ordo && <span className="mr-2">канва: {scope.ordo}</span>}
                {manifest.license && <span className="mr-2">лицензия: {manifest.license}</span>}
                {manifest.gates === "none"
                    ? <span className="text-red-900">внутренний пакет — ворота прав не применялись, наружу его не передают</span>
                    : <span>ворота прав применены: удержанное помечено в тексте</span>}
            </p>
            <p className="font-serif text-xs text-slate-500">
                служб: {parsed.services.length}; строк с текстом: {counts.present ?? 0}
                {silent.length > 0 && `; молчат: ${silent.join(", ")}`}
            </p>
            {externalCount > 0 && (
                <p className="font-serif text-xs text-slate-500">
                    {resolvedCount > 0
                        ? `Писание дорезолвлено: ${resolvedCount} адрес(ов).`
                        : "Писание в пакете адресами — дорезолвим при связи."}
                    {resolveNote && ` ${resolveNote}`}
                </p>
            )}
            {parsed.beda.length > 0 && (
                <p className="font-serif text-xs text-red-900 mt-1">
                    сшивка с расхождениями: {parsed.beda.slice(0, 3).join("; ")}
                    {parsed.beda.length > 3 && ` и ещё ${parsed.beda.length - 3}`}
                </p>
            )}
            {rulesMissing && (
                <p className="font-serif text-xs text-slate-500 mt-1">
                    таблицы подач не доехали (нет связи со службой): доступно только полное последование.
                </p>
            )}
            <label className="flex flex-col gap-0.5 mt-3 max-w-xs">
                <span className="text-[11px] text-slate-500 font-serif">Подача</span>
                <select className="w-full border rounded px-1 py-0.5 text-sm font-serif bg-white"
                        value={effectiveView} onChange={e => setView(e.target.value)}>
                    {choices.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
            </label>
            <div className="mt-2 flex flex-col gap-4">
                {parsed.services.map(s => (
                    <div key={s.key}>
                        {s.error
                            ? <Failed label={s.label ?? s.key} why={s.error} />
                            : <ServiceView service={servedOf(s)} rules={applied} view={effectiveView} />}
                    </div>
                ))}
            </div>
        </section>
    );
};

const PackageMode = ({ children }: { children: ReactNode }) => {
    const [loaded, setLoaded] = useState<{ name: string; parsed: ParsedPackage } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const onFile = async (file: File) => {
        setError(null);
        if (file.size > MAX_BYTES) {
            setError("Файл больше 20 МБ — на пакет службы это не похоже.");
            return;
        }
        try {
            const parsed = parsePackage(new Uint8Array(await file.arrayBuffer()));
            if (!parsed.day && !parsed.services.length) {
                setError("В архиве нет ordo.json — это не пакет последования.");
                return;
            }
            setLoaded({ name: file.name, parsed });
        } catch {
            setError("Файл не читается как zip-архив.");
        }
    };

    if (loaded) {
        return <Loaded name={loaded.name} parsed={loaded.parsed} onClose={() => setLoaded(null)} />;
    }

    return (
        <>
            <div className="flex items-center gap-3 mt-1">
                <button onClick={() => inputRef.current?.click()}
                        className="text-xs font-serif text-slate-600 border border-slate-200 rounded px-2 py-1 hover:bg-slate-50">
                    Открыть пакет…
                </button>
                <span className="text-[11px] text-slate-400 font-serif">
                    файл .ordo — последование можно читать без сети
                </span>
                <input ref={inputRef} type="file" accept=".ordo,.zip,application/zip" className="hidden"
                       onChange={e => {
                           const f = e.target.files?.[0];
                           if (f) void onFile(f);
                           e.target.value = "";
                       }} />
            </div>
            {error && <p className="font-serif text-xs text-red-900 mt-1">{error}</p>}
            {children}
        </>
    );
};

export default PackageMode;

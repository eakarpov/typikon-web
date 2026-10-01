'use client';
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { parsePackage, type ParsedPackage } from "@/lib/ordoPackageReader";
import { UKAZANIYA, viewChoices } from "@/lib/ordoView";
import type { OrdoViewRules } from "@/lib/ordo";
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
// но называем его внутренним.
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

const Loaded = ({ name, parsed, onClose }: { name: string; parsed: ParsedPackage; onClose: () => void }) => {
    const [rules, setRules] = useState<OrdoViewRules | null>(null);
    const [rulesMissing, setRulesMissing] = useState(false);
    const [view, setView] = useState("full");

    useEffect(() => {
        fetch("/api/ordo/view-rules")
            .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
            .then((r: OrdoViewRules) => setRules(r))
            .catch(() => setRulesMissing(true));
    }, []);

    const manifest = parsed.manifest ?? {};
    const scope = manifest.scope ?? {};
    const counts = manifest.body_counts ?? {};
    const applied = rules ?? FALLBACK_RULES;
    const choices = viewChoices(applied).filter(c => c.key !== UKAZANIYA);
    // выбранная подая может исчезнуть, если таблицы не доехали: тогда полное
    const effectiveView = choices.some(c => c.key === view) ? view : "full";

    const served: Served = {
        label: `${scope.date ?? "без даты"} · ${scope.service ?? "служба"}`,
        feastLabel: parsed.ordo?.feast_label ?? null,
        placementWhy: null,
        steps: parsed.steps,
        ukazaniya: [],
        rules: parsed.ordo?.rules ?? [],
    };

    const silent = Object.entries(counts)
        .filter(([k, v]) => k !== "present" && typeof v === "number" && v > 0)
        .map(([k, v]) => `${COUNT_LABEL[k] ?? k} — ${v}`);

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
                {scope.ordo && <span className="mr-2">канва: {scope.ordo}</span>}
                {manifest.license && <span className="mr-2">лицензия: {manifest.license}</span>}
                {manifest.gates === "none"
                    ? <span className="text-red-900">внутренний пакет — ворота прав не применялись, наружу его не передают</span>
                    : <span>ворота прав применены: удержанное помечено в тексте</span>}
            </p>
            <p className="font-serif text-xs text-slate-500">
                строк с текстом: {counts.present ?? 0}
                {silent.length > 0 && `; молчат: ${silent.join(", ")}`}
            </p>
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
            <div className="mt-2">
                <ServiceView service={served} rules={applied} view={effectiveView} />
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
            if (!parsed.ordo) {
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

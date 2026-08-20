"use client";
import {useMemo, useState} from "react";

type StagingNoble = {
    id: number;
    batchId: number;
    wikidataId: string;
    name: string;
    birthDate: string | null;
    deathDate: string | null;
    gender: number | null;
    fatherWikidataId: string | null;
    motherWikidataId: string | null;
    isSaintOrthodox: number;
    isSaintCatholic: number;
    isBoundary: number;
    boundaryFamilyLabel: string | null;
    matchedNobleId: number | null;
    matchConfidence: "new" | "fuzzy";
    status: "pending" | "approved" | "rejected" | "merged";
    matchedName: string | null;
    matchedBirthDate: string | null;
    matchedDeathDate: string | null;
    matchedIsSaintOrthodox: number | null;
};

type StagingRule = {
    id: number;
    batchId: number;
    personWikidataId: string;
    stateId: number;
    title: string | null;
    startDate: string | null;
    endDate: string | null;
    rawPositionLabel: string;
    matchedRuleId: number | null;
    status: "pending" | "approved" | "rejected" | "merged";
    personName: string | null;
    personNobleId: number | null;
    stateName: string;
    matchedStartDate: string | null;
    matchedEndDate: string | null;
};

const year = (v?: string | null) => (v ? v.slice(0, 4) : "?");

const StatusPill = ({status}: {status: string}) => {
    const colors: Record<string, string> = {
        pending: "bg-amber-100 text-amber-700",
        approved: "bg-green-100 text-green-700",
        rejected: "bg-red-100 text-red-700",
        merged: "bg-blue-100 text-blue-700",
    };
    return <span className={`text-xs px-2 py-0.5 rounded ${colors[status] ?? ""}`}>{status}</span>;
};

const Editor = ({value}: {value: {batch: any; nobles: StagingNoble[]; families: any[]; couplesCount: number; rules: StagingRule[]}}) => {
    const [nobles, setNobles] = useState(value.nobles);
    const [rules, setRules] = useState(value.rules);
    const [rulesStatusFilter, setRulesStatusFilter] = useState<"all" | "pending" | "approved" | "rejected" | "merged">("pending");
    const [scopeFilter, setScopeFilter] = useState<"all" | "core" | "boundary">("all");
    const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected" | "merged">("pending");
    const [search, setSearch] = useState("");
    const [merging, setMerging] = useState(false);
    const [mergeResult, setMergeResult] = useState<string | null>(null);

    const setStatus = async (id: number, status: "approved" | "rejected") => {
        setNobles((prev) => prev.map((n) => (n.id === id ? {...n, status} : n)));
        await fetch(`/api/admin/nobles/import/${value.batch.id}/nobles/${id}`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({status}),
        });
    };

    const bulkApproveConfident = async () => {
        const targets = filtered.filter((n) => n.status === "pending" && n.isBoundary === 0 && n.matchConfidence === "new");
        setNobles((prev) => prev.map((n) => (targets.some((t) => t.id === n.id) ? {...n, status: "approved"} : n)));
        await Promise.all(
            targets.map((n) =>
                fetch(`/api/admin/nobles/import/${value.batch.id}/nobles/${n.id}`, {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({status: "approved"}),
                }),
            ),
        );
    };

    const setRuleStatus = async (id: number, status: "approved" | "rejected") => {
        setRules((prev) => prev.map((r) => (r.id === id ? {...r, status} : r)));
        await fetch(`/api/admin/nobles/import/${value.batch.id}/rules/${id}`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({status}),
        });
    };

    const bulkApproveRulesConfident = async () => {
        const targets = filteredRules.filter((r) => r.status === "pending" && !r.matchedRuleId && r.personNobleId);
        setRules((prev) => prev.map((r) => (targets.some((t) => t.id === r.id) ? {...r, status: "approved"} : r)));
        await Promise.all(
            targets.map((r) =>
                fetch(`/api/admin/nobles/import/${value.batch.id}/rules/${r.id}`, {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({status: "approved"}),
                }),
            ),
        );
    };

    const runMerge = async () => {
        setMerging(true);
        setMergeResult(null);
        try {
            const res = await fetch(`/api/admin/nobles/import/${value.batch.id}/merge`, {method: "POST"});
            const data = await res.json();
            if (!res.ok) {
                setMergeResult(`Ошибка: ${data?.error ?? res.status}`);
            } else {
                setMergeResult(
                    `Смержено: ${data.mergedNobles} персон, ${data.mergedCouples} браков, ${data.mergedFamilies} родов, ${data.mergedRules ?? 0} правлений.`,
                );
                setNobles((prev) => prev.map((n) => (n.status === "approved" ? {...n, status: "merged"} : n)));
                setRules((prev) => prev.map((r) => (r.status === "approved" ? {...r, status: "merged"} : r)));
            }
        } finally {
            setMerging(false);
        }
    };

    const filteredRules = useMemo(() => {
        return rules.filter((r) => rulesStatusFilter === "all" || r.status === rulesStatusFilter);
    }, [rules, rulesStatusFilter]);

    const filtered = useMemo(() => {
        return nobles.filter((n) => {
            if (scopeFilter === "core" && n.isBoundary) return false;
            if (scopeFilter === "boundary" && !n.isBoundary) return false;
            if (statusFilter !== "all" && n.status !== statusFilter) return false;
            if (search && !n.name.toLowerCase().includes(search.toLowerCase())) return false;
            return true;
        });
    }, [nobles, scopeFilter, statusFilter, search]);

    return (
        <div className="flex flex-col">
            <div className="flex flex-row items-center gap-4 mb-4">
                {nobles.length > 0 && (
                    <button className="px-3 py-1 border rounded" onClick={bulkApproveConfident}>
                        Одобрить видимые новые (ствол, без сопоставления)
                    </button>
                )}
                {rules.length > 0 && (
                    <button className="px-3 py-1 border rounded" onClick={bulkApproveRulesConfident}>
                        Одобрить видимые новые правления (без пересечения с существующими)
                    </button>
                )}
                <button className="px-3 py-1 border rounded bg-blue-50" disabled={merging} onClick={runMerge}>
                    {merging ? "Мержим..." : "Смержить одобренные в живые таблицы"}
                </button>
                {mergeResult && <p className="text-sm">{mergeResult}</p>}
            </div>

            {nobles.length > 0 && (
            <div className="flex flex-row gap-4 mb-4 text-sm">
                <div className="flex flex-row gap-1">
                    {(["all", "core", "boundary"] as const).map((s) => (
                        <button
                            key={s}
                            className={`px-2 py-1 border rounded ${scopeFilter === s ? "bg-slate-200" : ""}`}
                            onClick={() => setScopeFilter(s)}
                        >
                            {s === "all" ? "все" : s === "core" ? "ствол" : "граница"}
                        </button>
                    ))}
                </div>
                <div className="flex flex-row gap-1">
                    {(["all", "pending", "approved", "rejected", "merged"] as const).map((s) => (
                        <button
                            key={s}
                            className={`px-2 py-1 border rounded ${statusFilter === s ? "bg-slate-200" : ""}`}
                            onClick={() => setStatusFilter(s)}
                        >
                            {s}
                        </button>
                    ))}
                </div>
                <input
                    className="border px-2 py-1 rounded"
                    placeholder="поиск по имени"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <p className="text-slate-400">
                    показано {filtered.length} из {nobles.length}
                </p>
            </div>
            )}

            <div className="flex flex-col">
                {filtered.map((n) => (
                    <div key={n.id} className="flex flex-row items-start gap-3 border-b py-2 text-sm">
                        <div className="w-64">
                            <a
                                href={`https://www.wikidata.org/wiki/${n.wikidataId}`}
                                target="_blank"
                                rel="noreferrer"
                                className="font-medium hover:underline"
                            >
                                {n.name}
                            </a>
                            <div className="text-slate-400">
                                {year(n.birthDate)}–{year(n.deathDate)}
                                {n.isSaintOrthodox ? " · святой (правосл.)" : ""}
                                {n.isSaintCatholic ? " · святой (катол.)" : ""}
                            </div>
                        </div>
                        <div className="w-20">
                            {n.isBoundary ? (
                                <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700">
                                    граница{n.boundaryFamilyLabel ? `: ${n.boundaryFamilyLabel}` : ""}
                                </span>
                            ) : (
                                <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">ствол</span>
                            )}
                        </div>
                        <div className="w-64">
                            {n.matchedNobleId ? (
                                <div className="text-xs">
                                    <div className="text-slate-500">сопоставлено с существующей записью:</div>
                                    <div>
                                        {n.matchedName} ({year(n.matchedBirthDate)}–{year(n.matchedDeathDate)})
                                    </div>
                                </div>
                            ) : (
                                <div className="text-xs text-slate-400">новая запись</div>
                            )}
                        </div>
                        <div className="w-20">
                            <StatusPill status={n.status} />
                        </div>
                        <div className="flex flex-row gap-2">
                            {n.status !== "approved" && n.status !== "merged" && (
                                <button className="px-2 py-1 border rounded text-green-700" onClick={() => setStatus(n.id, "approved")}>
                                    Одобрить
                                </button>
                            )}
                            {n.status !== "rejected" && n.status !== "merged" && (
                                <button className="px-2 py-1 border rounded text-red-700" onClick={() => setStatus(n.id, "rejected")}>
                                    Отклонить
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {rules.length > 0 && (
                <div className="flex flex-col mt-6">
                    <div className="flex flex-row gap-1 mb-4 text-sm">
                        {(["all", "pending", "approved", "rejected", "merged"] as const).map((s) => (
                            <button
                                key={s}
                                className={`px-2 py-1 border rounded ${rulesStatusFilter === s ? "bg-slate-200" : ""}`}
                                onClick={() => setRulesStatusFilter(s)}
                            >
                                {s}
                            </button>
                        ))}
                        <p className="text-slate-400 ml-2">
                            показано {filteredRules.length} из {rules.length}
                        </p>
                    </div>
                    {filteredRules.map((r) => (
                        <div key={r.id} className="flex flex-row items-start gap-3 border-b py-2 text-sm">
                            <div className="w-56">
                                <a
                                    href={`https://www.wikidata.org/wiki/${r.personWikidataId}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-medium hover:underline"
                                >
                                    {r.personName ?? r.personWikidataId}
                                </a>
                                {!r.personNobleId && <div className="text-xs text-amber-600">персона ещё не смержена</div>}
                            </div>
                            <div className="w-56">
                                <div>{r.stateName}</div>
                                <div className="text-slate-400 text-xs">{r.rawPositionLabel}</div>
                            </div>
                            <div className="w-36 text-slate-500">
                                {year(r.startDate)}–{year(r.endDate)}
                            </div>
                            <div className="w-56">
                                {r.matchedRuleId ? (
                                    <div className="text-xs">
                                        <div className="text-slate-500">уже есть в rules:</div>
                                        <div>
                                            {year(r.matchedStartDate)}–{year(r.matchedEndDate)}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-xs text-slate-400">новая запись</div>
                                )}
                            </div>
                            <div className="w-20">
                                <StatusPill status={r.status} />
                            </div>
                            <div className="flex flex-row gap-2">
                                {r.status !== "approved" && r.status !== "merged" && (
                                    <button className="px-2 py-1 border rounded text-green-700" onClick={() => setRuleStatus(r.id, "approved")}>
                                        Одобрить
                                    </button>
                                )}
                                {r.status !== "rejected" && r.status !== "merged" && (
                                    <button className="px-2 py-1 border rounded text-red-700" onClick={() => setRuleStatus(r.id, "rejected")}>
                                        Отклонить
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Editor;

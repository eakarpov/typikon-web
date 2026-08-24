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

type StagingDuplicate = {
    id: number;
    canonicalNobleId: number;
    duplicateNobleId: number;
    canonicalName: string;
    duplicateName: string;
    canonicalBirthDate: string | null;
    canonicalDeathDate: string | null;
    duplicateBirthDate: string | null;
    duplicateDeathDate: string | null;
    confidence: "confirmed" | "name-only";
    status: "pending" | "approved" | "rejected" | "merged";
};

type StagingDneslovLink = {
    id: number;
    nobleId: number;
    dneslovId: string;
    matchedName: string | null;
    matchedYearDate: string | null;
    confidence: "confirmed" | "name-only";
    status: "pending" | "approved" | "rejected" | "merged";
    nobleName: string;
    nobleBirthDate: string | null;
    nobleDeathDate: string | null;
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

const Editor = ({
    value,
}: {
    value: {
        batch: any;
        nobles: StagingNoble[];
        families: any[];
        couplesCount: number;
        rules: StagingRule[];
        duplicates: StagingDuplicate[];
        dneslovLinks: StagingDneslovLink[];
    };
}) => {
    const [nobles, setNobles] = useState(value.nobles);
    const [rules, setRules] = useState(value.rules);
    const [duplicates, setDuplicates] = useState(value.duplicates);
    const [dneslovLinks, setDneslovLinks] = useState(value.dneslovLinks);
    const [rulesStatusFilter, setRulesStatusFilter] = useState<"all" | "pending" | "approved" | "rejected" | "merged">("pending");
    const [dupStatusFilter, setDupStatusFilter] = useState<"all" | "pending" | "approved" | "rejected" | "merged">("pending");
    const [dneslovStatusFilter, setDneslovStatusFilter] = useState<"all" | "pending" | "approved" | "rejected" | "merged">("pending");
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

    const setDupStatus = async (id: number, status: "approved" | "rejected") => {
        setDuplicates((prev) => prev.map((d) => (d.id === id ? {...d, status} : d)));
        await fetch(`/api/admin/nobles/import/${value.batch.id}/duplicates/${id}`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({status}),
        });
    };

    const bulkApproveDupsConfident = async () => {
        const targets = filteredDuplicates.filter((d) => d.status === "pending" && d.confidence === "confirmed");
        setDuplicates((prev) => prev.map((d) => (targets.some((t) => t.id === d.id) ? {...d, status: "approved"} : d)));
        await Promise.all(
            targets.map((d) =>
                fetch(`/api/admin/nobles/import/${value.batch.id}/duplicates/${d.id}`, {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({status: "approved"}),
                }),
            ),
        );
    };

    const setDneslovStatus = async (id: number, status: "approved" | "rejected") => {
        setDneslovLinks((prev) => prev.map((l) => (l.id === id ? {...l, status} : l)));
        await fetch(`/api/admin/nobles/import/${value.batch.id}/dneslov/${id}`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({status}),
        });
    };

    const bulkApproveDneslovConfident = async () => {
        const targets = filteredDneslov.filter((l) => l.status === "pending" && l.confidence === "confirmed");
        setDneslovLinks((prev) => prev.map((l) => (targets.some((t) => t.id === l.id) ? {...l, status: "approved"} : l)));
        await Promise.all(
            targets.map((l) =>
                fetch(`/api/admin/nobles/import/${value.batch.id}/dneslov/${l.id}`, {
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
                    `Смержено: ${data.mergedNobles} персон, ${data.mergedCouples} браков, ${data.mergedFamilies} родов, ` +
                        `${data.mergedRules ?? 0} правлений, ${data.mergedDuplicates ?? 0} дублей, ${data.mergedDneslov ?? 0} связей со святыми.`,
                );
                setNobles((prev) => prev.map((n) => (n.status === "approved" ? {...n, status: "merged"} : n)));
                setRules((prev) => prev.map((r) => (r.status === "approved" ? {...r, status: "merged"} : r)));
                setDuplicates((prev) => prev.map((d) => (d.status === "approved" ? {...d, status: "merged"} : d)));
                setDneslovLinks((prev) => prev.map((l) => (l.status === "approved" ? {...l, status: "merged"} : l)));
            }
        } finally {
            setMerging(false);
        }
    };

    const filteredRules = useMemo(() => {
        return rules.filter((r) => rulesStatusFilter === "all" || r.status === rulesStatusFilter);
    }, [rules, rulesStatusFilter]);

    const filteredDuplicates = useMemo(() => {
        return duplicates.filter((d) => dupStatusFilter === "all" || d.status === dupStatusFilter);
    }, [duplicates, dupStatusFilter]);

    const filteredDneslov = useMemo(() => {
        return dneslovLinks.filter((l) => dneslovStatusFilter === "all" || l.status === dneslovStatusFilter);
    }, [dneslovLinks, dneslovStatusFilter]);

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
                {duplicates.length > 0 && (
                    <button className="px-3 py-1 border rounded" onClick={bulkApproveDupsConfident}>
                        Одобрить подтверждённые дубли (отчество+годы совпали)
                    </button>
                )}
                {dneslovLinks.length > 0 && (
                    <button className="px-3 py-1 border rounded" onClick={bulkApproveDneslovConfident}>
                        Одобрить подтверждённые связи со святыми (имя+год совпали)
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

            {duplicates.length > 0 && (
                <div className="flex flex-col mt-6">
                    <p className="font-medium mb-2">Дубли персон</p>
                    <div className="flex flex-row gap-1 mb-4 text-sm">
                        {(["all", "pending", "approved", "rejected", "merged"] as const).map((s) => (
                            <button
                                key={s}
                                className={`px-2 py-1 border rounded ${dupStatusFilter === s ? "bg-slate-200" : ""}`}
                                onClick={() => setDupStatusFilter(s)}
                            >
                                {s}
                            </button>
                        ))}
                        <p className="text-slate-400 ml-2">
                            показано {filteredDuplicates.length} из {duplicates.length}
                        </p>
                    </div>
                    {filteredDuplicates.map((d) => (
                        <div key={d.id} className="flex flex-row items-start gap-3 border-b py-2 text-sm">
                            <div className="w-64">
                                <div className="text-slate-500 text-xs">останется (canonical):</div>
                                <div className="font-medium">{d.canonicalName}</div>
                                <div className="text-slate-400 text-xs">
                                    {year(d.canonicalBirthDate)}–{year(d.canonicalDeathDate)}
                                </div>
                            </div>
                            <div className="w-64">
                                <div className="text-slate-500 text-xs">удалится (duplicate), станет:</div>
                                <div className="font-medium">{d.duplicateName}</div>
                                <div className="text-slate-400 text-xs">
                                    {year(d.duplicateBirthDate)}–{year(d.duplicateDeathDate)}
                                </div>
                            </div>
                            <div className="w-28">
                                <span
                                    className={`text-xs px-2 py-0.5 rounded ${
                                        d.confidence === "confirmed" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                                    }`}
                                >
                                    {d.confidence === "confirmed" ? "подтверждено" : "по имени"}
                                </span>
                            </div>
                            <div className="w-20">
                                <StatusPill status={d.status} />
                            </div>
                            <div className="flex flex-row gap-2">
                                {d.status !== "approved" && d.status !== "merged" && (
                                    <button className="px-2 py-1 border rounded text-green-700" onClick={() => setDupStatus(d.id, "approved")}>
                                        Одобрить
                                    </button>
                                )}
                                {d.status !== "rejected" && d.status !== "merged" && (
                                    <button className="px-2 py-1 border rounded text-red-700" onClick={() => setDupStatus(d.id, "rejected")}>
                                        Отклонить
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {dneslovLinks.length > 0 && (
                <div className="flex flex-col mt-6">
                    <p className="font-medium mb-2">Связи со святыми (dneslov.org)</p>
                    <div className="flex flex-row gap-1 mb-4 text-sm">
                        {(["all", "pending", "approved", "rejected", "merged"] as const).map((s) => (
                            <button
                                key={s}
                                className={`px-2 py-1 border rounded ${dneslovStatusFilter === s ? "bg-slate-200" : ""}`}
                                onClick={() => setDneslovStatusFilter(s)}
                            >
                                {s}
                            </button>
                        ))}
                        <p className="text-slate-400 ml-2">
                            показано {filteredDneslov.length} из {dneslovLinks.length}
                        </p>
                    </div>
                    {filteredDneslov.map((l) => (
                        <div key={l.id} className="flex flex-row items-start gap-3 border-b py-2 text-sm">
                            <div className="w-64">
                                <div className="font-medium">{l.nobleName}</div>
                                <div className="text-slate-400 text-xs">
                                    {year(l.nobleBirthDate)}–{year(l.nobleDeathDate)}
                                </div>
                            </div>
                            <div className="w-64">
                                <a
                                    href={`https://dneslov.org/api/v0/memories/${l.dneslovId}.json`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="hover:underline"
                                >
                                    {l.matchedName ?? l.dneslovId}
                                </a>
                                <div className="text-slate-400 text-xs">год: {l.matchedYearDate ?? "?"}</div>
                            </div>
                            <div className="w-28">
                                <span
                                    className={`text-xs px-2 py-0.5 rounded ${
                                        l.confidence === "confirmed" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                                    }`}
                                >
                                    {l.confidence === "confirmed" ? "подтверждено" : "по имени"}
                                </span>
                            </div>
                            <div className="w-20">
                                <StatusPill status={l.status} />
                            </div>
                            <div className="flex flex-row gap-2">
                                {l.status !== "approved" && l.status !== "merged" && (
                                    <button className="px-2 py-1 border rounded text-green-700" onClick={() => setDneslovStatus(l.id, "approved")}>
                                        Одобрить
                                    </button>
                                )}
                                {l.status !== "rejected" && l.status !== "merged" && (
                                    <button className="px-2 py-1 border rounded text-red-700" onClick={() => setDneslovStatus(l.id, "rejected")}>
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

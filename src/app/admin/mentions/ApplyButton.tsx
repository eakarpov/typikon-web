'use client';
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

const ApplyButton = ({ approved }: { approved: number }) => {
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<string | null>(null);

    const onApply = useCallback(async () => {
        if (!approved) return;
        if (!confirm(`Проставить ${approved} подтверждённых упоминаний в mentionIds?`)) return;
        setBusy(true);
        const res = await fetch("/api/admin/mentions/apply", { method: "POST" });
        const data = await res.json().catch(() => null);
        setBusy(false);
        setResult(res.ok ? `Проставлено связей: ${data?.links ?? 0} в ${data?.texts ?? 0} текстах` : "Ошибка");
        router.refresh();
    }, [approved, router]);

    return (
        <span className="flex flex-row items-center gap-2">
            <button
                type="button"
                onClick={onApply}
                disabled={!approved || busy}
                className={`px-3 py-1 border rounded ${
                    approved && !busy ? "border-green-700 text-green-700" : "border-slate-300 text-slate-400"
                }`}
            >
                {busy ? "Пишу..." : `Проставить подтверждённые (${approved})`}
            </button>
            {result && <span className="text-sm text-slate-600">{result}</span>}
        </span>
    );
};

export default ApplyButton;

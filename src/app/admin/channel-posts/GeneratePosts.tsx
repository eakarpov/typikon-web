'use client';
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const JOB_KEY = "typikon-channel-posts-generation";
export default function GeneratePosts() {
    const router = useRouter();
    const [from, setFrom] = useState("");
    const [daysAhead, setDaysAhead] = useState(3);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    const [jobId, setJobId] = useState<string | null>(null);
    const [attempt, setAttempt] = useState(0);
    useEffect(() => { try { setJobId(sessionStorage.getItem(JOB_KEY)); } catch {} }, []);
    useEffect(() => {
        if (!jobId) return;
        const controller = new AbortController();
        setBusy(true);
        const poll = async () => {
            try {
                while (!controller.signal.aborted) {
                    const res = await fetch(`/api/admin/channel-posts/generate?id=${encodeURIComponent(jobId)}`, { signal: controller.signal, cache: "no-store" });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || "Не удалось проверить результат");
                    if (data.status !== "running") {
                        setMessage(data.status === "completed"
                            ? `Создано черновиков: ${data.result.created}. Проверено дней: ${data.result.days}.`
                            : data.error || "Генерация прервана");
                        try { sessionStorage.removeItem(JOB_KEY); } catch {}
                        setJobId(null);
                        router.refresh();
                        return;
                    }
                    await new Promise(resolve => setTimeout(resolve, 1500));
                }
            } catch (error) {
                if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "Нет ответа сервера");
            } finally { if (!controller.signal.aborted) setBusy(false); }
        };
        void poll();
        return () => controller.abort();
    }, [jobId, attempt, router]);
    const generate = async () => {
        if (jobId) { setAttempt(value => value + 1); return; }
        setBusy(true);
        setMessage("");
        try {
            const res = await fetch("/api/admin/channel-posts/generate", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...(from ? { from } : {}), daysAhead }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Не удалось запустить генерацию");
            try { sessionStorage.setItem(JOB_KEY, data.jobId); } catch {}
            setJobId(data.jobId);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Нет ответа сервера");
            setBusy(false);
        }
    };
    return <fieldset disabled={busy} className="border rounded p-3 flex flex-wrap items-center gap-3 font-serif">
        <legend>Пачка черновиков из чтений дня</legend>
        <label>С даты (новый стиль) <input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
        <label>Дней вперёд <input className="border w-16" type="number" min={0} max={30} value={daysAhead} onChange={e => setDaysAhead(Number(e.target.value))} /></label>
        <button type="button" className="border rounded px-3 py-2" onClick={generate}>{busy ? "Генерирую…" : jobId ? "Проверить результат" : "Сгенерировать"}</button>
        <p className="w-full text-sm">Без даты — с сегодняшнего дня по Москве. Включая начальный день; существующие посты сохраняются.</p>
        {message && <p role="status" className="w-full">{message}</p>}
    </fieldset>;
}

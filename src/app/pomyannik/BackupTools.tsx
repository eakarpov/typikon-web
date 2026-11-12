'use client';
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { PomyannikPerson } from "@/lib/pomyannik/types";
import { MAX_PERSONS } from "@/lib/pomyannik/types";
import { MAX_BACKUP_MB, MAX_BACKUP_BYTES, parseBackup, planRestore, type PomyannikBackup } from "@/lib/pomyannik/backup";
import { displayName } from "./labels";

const BUTTON = "border rounded px-3 py-2 bg-slate-50 hover:bg-slate-100 font-serif text-sm disabled:opacity-50";
export default function BackupTools({ persons }: { persons: PomyannikPerson[] }) {
    const router = useRouter();
    const [backup, setBackup] = useState<PomyannikBackup | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const plan = useMemo(() => backup ? planRestore(persons, backup.persons) : null, [backup, persons]);
    const tooMany = Boolean(plan && persons.length + plan.additions.length > MAX_PERSONS);
    const load = async (file?: File) => {
        setBackup(null); setError(""); setMessage("");
        if (!file) return;
        setBusy(true);
        try {
            if (file.size > MAX_BACKUP_BYTES) throw new Error(`Файл больше ${MAX_BACKUP_MB} МБ.`);
            setBackup(parseBackup(JSON.parse(await file.text())));
        } catch (e) { setError(e instanceof SyntaxError ? "Не удалось прочитать JSON-файл." : e instanceof Error ? e.message : "Не удалось прочитать файл."); }
        finally { setBusy(false); }
    };
    const restore = async () => {
        if (!backup) return;
        setBusy(true); setError(""); setMessage("");
        try {
            const response = await fetch("/api/pomyannik/restore", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(backup) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error ?? "Не удалось восстановить помянник.");
            setBackup(null);
            setMessage(`Добавлено имён: ${result.added}. Уже было в помяннике: ${result.skipped}.`);
            router.refresh();
        } catch (e) { setError(e instanceof Error ? e.message : "Не удалось восстановить помянник. Проверьте сеть."); }
        finally { setBusy(false); }
    };
    return <details className="border rounded p-3 font-serif text-sm">
        <summary className="cursor-pointer font-bold">Резервная копия и восстановление</summary>
        <div className="flex flex-col gap-3 mt-3">
            <p>Скачайте весь помянник с подписями, группами, датами, именинами и порядком имён. Фильтры списка не влияют на копию. Корзина в этот файл не входит. Файл содержит личные сведения; храните его у себя.</p>
            <a href="/api/pomyannik/backup" download className={`${BUTTON} self-start`}>Скачать резервную копию (.json)</a>
            <label className="flex flex-col gap-1">Восстановить из резервной копии
                <input type="file" accept=".json,application/json" disabled={busy}
                    onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; void load(file); }} />
            </label>
            <p className="text-slate-600">Сначала покажем состав файла. При восстановлении добавятся недостающие записи в порядке из копии. Существующие карточки сохранятся; точные совпадения будут пропущены. Изменённая карточка считается отдельной записью.</p>
            {backup && plan && <div className="border rounded p-3 space-y-2">
                <p>В файле: {backup.persons.length} имён, {backup.groups?.length??0} групп. Добавится: {plan.additions.length}. Уже есть: {plan.skipped}.</p>
                {tooMany && <p role="alert" className="text-amber-800">Превышен предел: {MAX_PERSONS} имён. Восстановление недоступно.</p>}
                {plan.additions.length > 0 && <ul className="max-h-60 overflow-auto list-disc pl-5" aria-label="Имена для восстановления">
                    {plan.additions.slice(0, 100).map((person, i) => <li key={i}>{displayName(person)}{person.signature ? ` · ${person.signature}` : ""} — {person.kind === "living" ? "о здравии" : "о упокоении"}</li>)}
                </ul>}
                {plan.additions.length > 100 && <p className="text-slate-500">Показаны первые 100 записей. При подтверждении добавятся все {plan.additions.length}.</p>}
                <div className="flex gap-3 flex-wrap">
                    <button type="button" className={BUTTON} disabled={busy || tooMany || (!plan.additions.length&&!backup.groups?.length)} onClick={restore}>Добавить недостающие записи</button>
                    <button type="button" className={BUTTON} disabled={busy} onClick={() => setBackup(null)}>Отмена</button>
                </div>
            </div>}
            {busy && <p role="status">Обрабатываем копию…</p>}
            {error && <p role="alert" className="text-amber-800">{error}</p>}
            {message && <p role="status">{message}</p>}
        </div>
    </details>;
}

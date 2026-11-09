'use client';
import { useState } from "react";

export default function GenerateAlias({ collection, id, name, category, onGenerated }: {
    collection: "books" | "texts"; id: string; name: string; category?: string; onGenerated: (alias: string) => void;
}) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const generate = async () => {
        setBusy(true);
        setError("");
        try {
            const res = await fetch("/api/admin/alias", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ collection, id, name, category }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Не удалось сгенерировать адрес");
            onGenerated(data.alias);
        } catch (error) { setError(error instanceof Error ? error.message : "Нет ответа сервера"); }
        finally { setBusy(false); }
    };
    return <div>
        <button type="button" disabled={busy || !name.trim()} onClick={generate} className="underline py-2">
            {busy ? "Генерирую…" : "Сгенерировать адрес по названию и тематике книги"}
        </button>
        {error && <p role="alert">{error}</p>}
        <p className="text-sm text-stone-500">Новый адрес применится после сохранения. Прежние ссылки сохранятся.</p>
    </div>;
}

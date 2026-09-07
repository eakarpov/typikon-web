'use client';

import { useCallback, useState } from "react";
import { reportClientError } from "@/lib/reportClientError";

// Живой поиск по таблице: адрес стиха — и где он стоит в каждом издании.
//
// Ходит в ту же ручку /api/v2/concordance, что и любой другой потребитель, а не
// в отдельную внутреннюю: страница показывает ровно то, что получит читатель у
// себя, и заодно служит проверкой ручки. Ключа для этого не нужно — раздел
// texts открыт и без него, шестьдесят запросов в час.

interface Place {
    book: string;
    chapter: number;
    verse: number;
}

interface EditionPlace {
    edition: string;
    book: string;
    places: Place[];
}

interface Answer {
    canonRef: string;
    editions: EditionPlace[];
}

const Lookup = ({ editionTitles }: { editionTitles: Record<string, string> }) => {
    const [ref, setRef] = useState("psaltir.9.13");
    const [from, setFrom] = useState("");
    const [answer, setAnswer] = useState<Answer | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const onSubmit = useCallback(async (event: React.FormEvent) => {
        event.preventDefault();
        setBusy(true);
        setError(null);

        try {
            const params = new URLSearchParams({ ref });
            if (from) params.set("from", from);

            const response = await fetch(`/api/v2/concordance?${params}`);
            const body = await response.json();

            if (!response.ok) {
                setAnswer(null);
                setError(body?.error?.message || "Не вышло");
                return;
            }

            setAnswer(body);
        } catch (e) {
            reportClientError(e, "versification: поиск по таблице");
            setAnswer(null);
            setError("Не удалось спросить — попробуйте ещё раз");
        } finally {
            setBusy(false);
        }
    }, [ref, from]);

    return (
        <div className="flex flex-col gap-3">
            <form onSubmit={onSubmit} className="flex flex-row flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1">
                    <span className="text-sm text-slate-600">адрес стиха</span>
                    <input
                        value={ref}
                        onChange={(e) => setRef(e.target.value)}
                        className="border-2 border-slate-300 px-2 py-1 font-mono text-sm"
                        placeholder="psaltir.9.13"
                    />
                </label>
                <label className="flex flex-col gap-1">
                    <span className="text-sm text-slate-600">в счёте издания</span>
                    <select
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                        className="border-2 border-slate-300 px-2 py-1 text-sm"
                    >
                        <option value="">канонический</option>
                        {Object.entries(editionTitles).map(([code, title]) => (
                            <option key={code} value={code}>{title}</option>
                        ))}
                    </select>
                </label>
                <button
                    type="submit"
                    disabled={busy}
                    className="border-2 border-amber-800 px-3 py-1 text-amber-800 disabled:opacity-50"
                >
                    Найти
                </button>
            </form>

            {error && <p className="text-slate-700">{error}</p>}

            {answer && (
                <div className="overflow-x-auto">
                    <table className="text-sm border-collapse">
                        <thead>
                            <tr className="text-left border-b border-slate-300">
                                <th className="pr-4 py-1 font-normal">издание</th>
                                <th className="pr-4 py-1 font-normal">книга издания</th>
                                <th className="py-1 font-normal">где стоит</th>
                            </tr>
                        </thead>
                        <tbody>
                            {answer.editions.map((place) => (
                                <tr key={place.edition} className="border-b border-slate-100">
                                    <td className="pr-4 py-1">
                                        {editionTitles[place.edition] || place.edition}
                                    </td>
                                    <td className="pr-4 py-1"><code>{place.book}</code></td>
                                    <td className="py-1 font-mono">
                                        {place.places.map((p) => `${p.chapter}:${p.verse}`).join(", ")}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <p className="pt-2 text-slate-700">
                        Канонический адрес — <code>{answer.canonRef}</code>. Издания, которого
                        нет в списке, этот стих не содержит вовсе.
                    </p>
                </div>
            )}
        </div>
    );
};

export default Lookup;

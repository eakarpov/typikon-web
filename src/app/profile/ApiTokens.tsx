'use client';
import React from "react";
import type { TokenView } from "@/app/api/api-tokens/service";

// Ключи доступа к API в профиле.
//
// Главная особенность интерфейса: открытый ключ показывается один раз, сразу после
// выпуска, и больше нигде — в базе лежит только его хэш. Поэтому выпущенный ключ
// висит в отдельной рамке с прямым предупреждением, а не строкой в общем списке.

const dateLabel = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }) : "—";

const windowLabel = (seconds: number) => (seconds === 60 ? "в минуту" : seconds === 3600 ? "в час" : `за ${seconds} с`);

const ApiTokens = ({ items }: { items: TokenView[] }) => {
    const [tokens, setTokens] = React.useState<TokenView[]>(items);
    const [name, setName] = React.useState("");
    const [issued, setIssued] = React.useState<string | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [busy, setBusy] = React.useState(false);

    const issue = () => {
        setBusy(true);
        setError(null);
        setIssued(null);

        fetch("/api/api-tokens", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
        })
            .then(async (res) => {
                const body = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(body?.error || "Не удалось выпустить ключ");

                setIssued(body.token);
                setTokens((old) => [body.item, ...old]);
                setName("");
            })
            .catch((e) => setError(e.message))
            .finally(() => setBusy(false));
    };

    const revoke = (id: string) => {
        if (!confirm("Отозвать ключ? Запросы с ним перестанут проходить.")) return;

        fetch(`/api/api-tokens/${id}`, { method: "DELETE" })
            .then((res) => {
                if (!res.ok) throw new Error("Не удалось отозвать ключ");
                setTokens((old) => old.filter((token) => token.id !== id));
            })
            .catch((e) => setError(e.message));
    };

    return (
        <div className="flex flex-col gap-3">
            <h3 className="font-bold">Ключи API</h3>
            <p className="text-sm text-slate-700">
                Ключ нужен, чтобы обращаться к{" "}
                <a href="/api" className="text-amber-800 underline underline-offset-4">API</a>{" "}
                из своей программы: он даёт больше, чем доступно без ключа, и открывает поиск.
                Передавайте его заголовком <code>Authorization: Bearer …</code>.
            </p>

            {issued && (
                <div className="flex flex-col gap-1 border-2 border-amber-700 rounded p-2 bg-amber-50">
                    <p className="text-sm font-bold">Ключ выпущен. Скопируйте его сейчас — второй раз он не покажется.</p>
                    <code className="text-xs break-all select-all">{issued}</code>
                </div>
            )}

            {error && <p className="text-sm text-red-700">{error}</p>}

            <div className="flex flex-row gap-2 items-end flex-wrap">
                <div className="flex flex-col">
                    <label className="text-sm">Название</label>
                    <input
                        className="border-2 px-1"
                        placeholder="Например: бот прихода"
                        value={name}
                        maxLength={60}
                        onChange={(e) => setName(e.target.value)}
                    />
                </div>
                <button className="border-2 px-2 py-1" disabled={busy} onClick={issue}>
                    {busy ? "Выпускаю…" : "Выпустить ключ"}
                </button>
            </div>

            {tokens.length === 0 ? (
                <p className="text-sm text-slate-600">Ключей пока нет.</p>
            ) : (
                <ul className="flex flex-col gap-2">
                    {tokens.map((token) => (
                        <li key={token.id} className="flex flex-col gap-1 border-l-2 border-slate-300 pl-3 py-1">
                            <div className="flex flex-row gap-2 items-baseline flex-wrap">
                                <span className="font-bold">{token.name}</span>
                                <code className="text-xs text-slate-600">{token.prefix}</code>
                                <button className="text-sm text-red-700 underline" onClick={() => revoke(token.id)}>
                                    отозвать
                                </button>
                            </div>
                            <p className="text-sm text-slate-700">
                                {token.limit} запросов {windowLabel(token.windowSeconds)}
                                {token.perDay !== null && `, ${token.perDay.toLocaleString("ru-RU")} в сутки`}
                                {" · "}
                                разделы: {token.scopes.join(", ")}
                            </p>
                            <p className="text-sm text-slate-600">
                                Израсходовано сегодня: {token.usedToday.toLocaleString("ru-RU")}
                                {token.perDay !== null && ` из ${token.perDay.toLocaleString("ru-RU")}`}
                                {" · "}
                                выпущен {dateLabel(token.createdAt)}
                                {" · "}
                                последний запрос {dateLabel(token.lastUsedAt)}
                            </p>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default ApiTokens;

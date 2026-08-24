'use client';
import React from "react";
import { useRouter } from "next/navigation";
import type { AdminTokenView } from "@/app/admin/api-tokens/api";

// Управление ключами публичного API.
//
// Открытый ключ показывается один раз, сразу после выпуска: в базе лежит только его
// sha256, показать второй раз нечего. Поэтому выпущенный ключ висит в отдельной рамке
// с предупреждением, а не строкой в списке.
//
// После каждой правки страница перезапрашивается (router.refresh): действующие числа
// складываются из тарифа и частных поправок, и считать их заново на клиенте значило бы
// держать вторую копию тех же правил.

export interface TierHint {
    id: string;
    limit: number;
    windowSeconds: number;
    perDay: number | null;
    scopes: string[];
    perClient: boolean;
}

type Filter = "live" | "revoked" | "all";

const dateLabel = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" }) : "—";

const windowLabel = (seconds: number) => (seconds === 60 ? "в минуту" : seconds === 3600 ? "в час" : `за ${seconds} с`);

const number = (value: number | null) => (value === null ? "без потолка" : value.toLocaleString("ru-RU"));

const stateLabel: Record<AdminTokenView["state"], string> = {
    ok: "",
    revoked: "отозван",
    expired: "просрочен",
};

const Manager = ({ items, tiers, scopes }: { items: AdminTokenView[]; tiers: TierHint[]; scopes: string[] }) => {
    const router = useRouter();

    const [filter, setFilter] = React.useState<Filter>("live");
    const [error, setError] = React.useState<string | null>(null);
    const [issued, setIssued] = React.useState<string | null>(null);
    const [editing, setEditing] = React.useState<string | null>(null);
    const [busy, setBusy] = React.useState(false);

    const send = async (url: string, body: unknown) => {
        setBusy(true);
        setError(null);

        try {
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = await res.json().catch(() => ({}));

            if (!res.ok) throw new Error(data?.error || "Не получилось");

            router.refresh();
            return data;
        } catch (e) {
            setError(e instanceof Error ? e.message : "Не получилось");
            return null;
        } finally {
            setBusy(false);
        }
    };

    const visible = items.filter((item) =>
        filter === "all" ? true : filter === "revoked" ? item.state !== "ok" : item.state === "ok");

    const live = items.filter((item) => item.state === "ok").length;

    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="flex flex-row gap-4 items-baseline flex-wrap">
                <p className="font-bold">Ключи публичного API — {items.length}</p>
                <p className="text-sm text-slate-600">действующих {live}, погашенных {items.length - live}</p>
                <div className="flex flex-row gap-2 text-sm">
                    {([["live", "действующие"], ["revoked", "погашенные"], ["all", "все"]] as [Filter, string][])
                        .map(([value, label]) => (
                            <button
                                key={value}
                                className={filter === value ? "font-bold underline underline-offset-4" : "text-slate-600"}
                                onClick={() => setFilter(value)}
                            >
                                {label}
                            </button>
                        ))}
                </div>
            </div>

            <p className="text-sm text-slate-600">
                Пользователи заводят себе ключи сами в профиле (тариф <code>free</code>, до пяти).
                Здесь выдаются ключи приложению и партнёрам и правятся числа у любого ключа.
                Отзыв вступает в силу не позже чем через полминуты — столько живёт кэш ключей.
            </p>

            {error && <p className="text-red-700">{error}</p>}

            {issued && (
                <div className="flex flex-col gap-1 border-2 border-amber-700 rounded p-2 bg-amber-50">
                    <p className="font-bold">Ключ выпущен. Скопируйте его сейчас — второй раз он не покажется.</p>
                    <code className="text-sm break-all select-all">{issued}</code>
                </div>
            )}

            <IssueForm
                tiers={tiers}
                scopes={scopes}
                busy={busy}
                onIssue={async (body) => {
                    const data = await send("/api/admin/api-tokens", body);
                    if (data?.token) setIssued(data.token);
                }}
            />

            {visible.length === 0 ? (
                <p className="text-slate-600">Ключей в этой выборке нет.</p>
            ) : (
                <ul className="flex flex-col gap-3">
                    {visible.map((item) => (
                        <li key={item.id} className="flex flex-col gap-1 border-l-2 border-slate-300 pl-3 py-1">
                            <div className="flex flex-row gap-2 items-baseline flex-wrap">
                                <span className="font-bold">{item.name}</span>
                                <code className="text-xs text-slate-600">{item.prefix}</code>
                                <span className="text-xs border px-1 rounded">{item.tier}</span>
                                {item.state !== "ok" && (
                                    <span className="text-xs text-red-700">{stateLabel[item.state]}</span>
                                )}
                                <span className="text-sm text-slate-600">
                                    {item.owner ? `пользователь ${item.owner.label}` : "выдан администратором"}
                                </span>
                            </div>

                            <p className="text-sm text-slate-700">
                                {item.limit} {windowLabel(item.windowSeconds)}
                                {", "}
                                сутки: {number(item.perDay)}
                                {" · "}
                                разделы: {item.scopes.join(", ")}
                            </p>

                            <p className="text-sm text-slate-600">
                                сегодня израсходовано {item.usedToday.toLocaleString("ru-RU")}
                                {" · "}выпущен {dateLabel(item.createdAt)}
                                {" · "}последний запрос {dateLabel(item.lastUsedAt)}
                                {item.expiresAt && ` · до ${dateLabel(item.expiresAt)}`}
                            </p>

                            <div className="flex flex-row gap-3 text-sm">
                                <button
                                    className="underline"
                                    onClick={() => setEditing(editing === item.id ? null : item.id)}
                                >
                                    {editing === item.id ? "не менять" : "изменить"}
                                </button>
                                {item.state === "revoked" ? (
                                    <button
                                        className="text-slate-700 underline"
                                        disabled={busy}
                                        onClick={() => send(`/api/admin/api-tokens/${item.id}`, { revoked: false })}
                                    >
                                        вернуть
                                    </button>
                                ) : (
                                    <button
                                        className="text-red-700 underline"
                                        disabled={busy}
                                        onClick={() => {
                                            if (!confirm(`Отозвать ключ «${item.name}»? Запросы с ним перестанут проходить.`)) return;
                                            send(`/api/admin/api-tokens/${item.id}`, { revoked: true });
                                        }}
                                    >
                                        отозвать
                                    </button>
                                )}
                            </div>

                            {editing === item.id && (
                                <EditForm
                                    item={item}
                                    tiers={tiers}
                                    scopes={scopes}
                                    busy={busy}
                                    onSave={async (body) => {
                                        const data = await send(`/api/admin/api-tokens/${item.id}`, body);
                                        if (data) setEditing(null);
                                    }}
                                />
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex flex-col">
        <label className="text-sm">{label}</label>
        {children}
    </div>
);

const ScopePicker = ({
    scopes, chosen, onChange,
}: { scopes: string[]; chosen: string[]; onChange: (next: string[]) => void }) => (
    <div className="flex flex-row gap-3 flex-wrap">
        {scopes.map((scope) => (
            <label key={scope} className="flex flex-row gap-1 items-center text-sm">
                <input
                    type="checkbox"
                    checked={chosen.includes(scope)}
                    onChange={(e) => onChange(e.target.checked ? [...chosen, scope] : chosen.filter((s) => s !== scope))}
                />
                {scope}
            </label>
        ))}
    </div>
);

const IssueForm = ({
    tiers, scopes, busy, onIssue,
}: { tiers: TierHint[]; scopes: string[]; busy: boolean; onIssue: (body: any) => void }) => {
    const [open, setOpen] = React.useState(false);
    const [name, setName] = React.useState("");
    const [tier, setTier] = React.useState(tiers.find((t) => t.id === "partner")?.id ?? tiers[0].id);
    const [limit, setLimit] = React.useState("");
    const [perDay, setPerDay] = React.useState("");
    const [days, setDays] = React.useState("");
    const [chosen, setChosen] = React.useState<string[]>([]);

    const hint = tiers.find((t) => t.id === tier)!;

    if (!open) {
        return (
            <button className="border-2 px-2 py-1 self-start" onClick={() => setOpen(true)}>
                Выпустить ключ
            </button>
        );
    }

    return (
        <div className="flex flex-col gap-2 border-2 border-slate-200 rounded p-3">
            <p className="font-bold">Новый ключ</p>
            <p className="text-sm text-slate-600">
                Пустые поля берутся из тарифа: {hint.limit} {windowLabel(hint.windowSeconds)},
                сутки {number(hint.perDay)}, разделы {hint.scopes.join(", ")}
                {hint.perClient && ", минутный лимит по устройству"}.
            </p>

            <div className="flex flex-row gap-3 flex-wrap items-end">
                <Field label="Название">
                    <input className="border-2 px-1" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
                </Field>
                <Field label="Тариф">
                    <select className="border-2 px-1" value={tier} onChange={(e) => setTier(e.target.value)}>
                        {tiers.map((t) => <option key={t.id} value={t.id}>{t.id}</option>)}
                    </select>
                </Field>
                <Field label="В минуту">
                    <input className="border-2 px-1 w-24" value={limit} placeholder={String(hint.limit)}
                           onChange={(e) => setLimit(e.target.value)} />
                </Field>
                <Field label="В сутки (none — без потолка)">
                    <input className="border-2 px-1 w-40" value={perDay} placeholder={number(hint.perDay)}
                           onChange={(e) => setPerDay(e.target.value)} />
                </Field>
                <Field label="Срок, дней">
                    <input className="border-2 px-1 w-24" value={days} placeholder="бессрочно"
                           onChange={(e) => setDays(e.target.value)} />
                </Field>
            </div>

            <Field label="Разделы (пусто — как в тарифе)">
                <ScopePicker scopes={scopes} chosen={chosen} onChange={setChosen} />
            </Field>

            <div className="flex flex-row gap-3">
                <button
                    className="border-2 px-2 py-1"
                    disabled={busy || !name.trim()}
                    onClick={() => onIssue({ name, tier, limit, perDay, days, scopes: chosen })}
                >
                    {busy ? "Выпускаю…" : "Выпустить"}
                </button>
                <button className="underline text-sm" onClick={() => setOpen(false)}>отмена</button>
            </div>
        </div>
    );
};

const EditForm = ({
    item, tiers, scopes, busy, onSave,
}: { item: AdminTokenView; tiers: TierHint[]; scopes: string[]; busy: boolean; onSave: (body: any) => void }) => {
    const [name, setName] = React.useState(item.name);
    const [tier, setTier] = React.useState<string>(item.tier);
    const [limit, setLimit] = React.useState(String(item.limit));
    const [perDay, setPerDay] = React.useState(item.perDay === null ? "none" : String(item.perDay));
    const [chosen, setChosen] = React.useState<string[]>(item.scopes);

    return (
        <div className="flex flex-col gap-2 border-2 border-slate-200 rounded p-3 mt-1">
            <div className="flex flex-row gap-3 flex-wrap items-end">
                <Field label="Название">
                    <input className="border-2 px-1" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
                </Field>
                <Field label="Тариф">
                    <select className="border-2 px-1" value={tier} onChange={(e) => setTier(e.target.value)}>
                        {tiers.map((t) => <option key={t.id} value={t.id}>{t.id}</option>)}
                    </select>
                </Field>
                <Field label="В минуту">
                    <input className="border-2 px-1 w-24" value={limit} onChange={(e) => setLimit(e.target.value)} />
                </Field>
                <Field label="В сутки (none — без потолка)">
                    <input className="border-2 px-1 w-40" value={perDay} onChange={(e) => setPerDay(e.target.value)} />
                </Field>
            </div>

            <Field label="Разделы">
                <ScopePicker scopes={scopes} chosen={chosen} onChange={setChosen} />
            </Field>

            <button
                className="border-2 px-2 py-1 self-start"
                disabled={busy || !chosen.length}
                onClick={() => onSave({ name, tier, limit, perDay, scopes: chosen })}
            >
                {busy ? "Сохраняю…" : "Сохранить"}
            </button>
        </div>
    );
};

export default Manager;

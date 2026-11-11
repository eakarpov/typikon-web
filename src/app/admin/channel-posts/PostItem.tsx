'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChannelPostDTO, TelegramPostCheck } from "@/types/dto/channelPost";
import { SITE_URL } from "@/utils/site";

const STATUS_LABEL: Record<string, string> = {
    draft: "Черновик",
    ready: "Готово к отправке",
    published: "Опубликовано",
    failed: "Ошибка отправки",
    skipped: "Пропущено",
};

const STATUS_CLASS: Record<string, string> = {
    draft: "bg-slate-200",
    ready: "bg-green-200",
    published: "bg-blue-200",
    failed: "bg-red-200",
    skipped: "bg-yellow-200",
};

const PostItem = ({ item }: { item: ChannelPostDTO }) => {
    const router = useRouter();
    const [text, setText] = useState(item.text || "");
    const [imageUrl, setImageUrl] = useState(item.imageUrl || "");
    const [hashtags, setHashtags] = useState((item.hashtags || []).join(" "));
    const [status, setStatus] = useState(item.status);
    const [vkEnabled, setVkEnabled] = useState(!!item.targets?.vk);
    const [checking, setChecking] = useState(false);
    const [checkResult, setCheckResult] = useState<TelegramPostCheck | null>(item.telegramCheck || null);
    const [saving, setSaving] = useState(false);
    const [deleted, setDeleted] = useState(false);
    const [sending, setSending] = useState(false);
    const [sendError, setSendError] = useState<string | null>(item.publishError || null);

    const save = async (fields: Record<string, unknown>) => {
        setSaving(true);
        try {
            const res = await fetch(`/api/admin/channel-posts/${item.id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(fields),
            });
            if (!res.ok) throw new Error("Не удалось сохранить пост. Отправка отменена.");
            if (fields.text !== undefined || fields.imageUrl !== undefined) setCheckResult(null);
            return true;
        } catch (e) {
            setSendError(e instanceof Error ? e.message : "Не удалось сохранить пост");
            return false;
        } finally {
            setSaving(false);
        }
    };

    const onSave = () =>
        save({ text, imageUrl, hashtags: hashtags.split(/\s+/).filter(Boolean) });

    const onToggleReady = async () => {
        const next = status === "ready" ? "draft" : "ready";
        setStatus(next);
        await save({ status: next });
    };

    const onToggleVk = async () => {
        const next = !vkEnabled;
        setVkEnabled(next);
        await save({ targets: { telegram: true, vk: next } });
    };

    const onCheck = async () => {
        setChecking(true);
        setSendError(null);
        try {
            if (!(await save({text, imageUrl, hashtags: hashtags.split(/\s+/).filter(Boolean)}))) return;
            const res = await fetch(`/api/admin/channel-posts/${item.id}/check`, {method: "POST"});
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || `Ошибка ${res.status}`);
            setCheckResult(data);
        } catch (e) {
            setCheckResult({status: "failed", checkedAt: new Date().toISOString(), error: e instanceof Error ? e.message : "Проверка не удалась"});
        } finally {
            setChecking(false);
        }
    };

    const onSendNow = async () => {
        if (!window.confirm("Отправить этот пост в Telegram прямо сейчас, не дожидаясь слота?")) return;
        setSending(true);
        setSendError(null);
        try {
            // сохраняем текущие правки, чтобы отправилось то, что видно на экране, а не старая версия
            if (!(await save({ text, imageUrl, hashtags: hashtags.split(/\s+/).filter(Boolean) }))) return;
            const res = await fetch(`/api/admin/channel-posts/${item.id}/send`, { method: "POST" });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setSendError(data.error || `Ошибка ${res.status}`);
                return;
            }
            setStatus("published");
            router.refresh();
        } catch (e) {
            setSendError(e instanceof Error ? e.message : "Ошибка отправки");
        } finally {
            setSending(false);
        }
    };

    const onDelete = async () => {
        if (!window.confirm("Удалить этот пост безвозвратно?")) return;
        setSaving(true);
        try {
            await fetch(`/api/admin/channel-posts/${item.id}`, { method: "DELETE" });
            setDeleted(true);
            router.refresh();
        } finally {
            setSaving(false);
        }
    };

    if (deleted) return null;

    return (
        <div className="flex flex-col border rounded border-slate-300 p-3 gap-2">
            <div className="flex flex-row justify-between items-center">
                <span className="font-serif">
                    {item.dayAlias} — {item.slot === "morning" ? "утро (9:00)" : "вечер (18:00)"} —{" "}
                    {new Date(item.scheduledAt).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })} МСК
                </span>
                <span className={`text-xs px-2 py-1 rounded ${STATUS_CLASS[status] || "bg-slate-200"}`}>
                    {STATUS_LABEL[status] || status}
                </span>
            </div>

            {item.nameSource === "heuristic" && (
                <div className="text-amber-700 text-sm">
                    ⚠️ Хэштег определён эвристикой (нет данных в Днеслове для этой памяти) — проверьте вручную
                </div>
            )}
            {item.nameSource === "none" && (
                <div className="text-amber-700 text-sm">
                    ⚠️ Не удалось определить святого для хэштега — заполните вручную
                </div>
            )}
            {(item.nameSource === "heuristic" || item.nameSource === "none") && (
                <div className="text-sm">
                    {item.dneslovSlug ? (
                        <a
                            className="text-blue-700 underline"
                            href={`https://dneslov.org/${item.dneslovSlug}?c=днес,рпц`}
                            target="_blank"
                            rel="noreferrer"
                        >
                            Проверить страницу на dneslov.org →
                        </a>
                    ) : item.dneslovId ? (
                        <a
                            className="text-blue-700 underline"
                            href={`${SITE_URL}/saints/${item.dneslovId}`}
                            target="_blank"
                            rel="noreferrer"
                        >
                            Проверить страницу святого на сайте →
                        </a>
                    ) : (
                        <span className="text-slate-500">
                            У текста не заполнен dneslovId — проверять нечего, это точно эвристика
                        </span>
                    )}
                </div>
            )}

            <div className="flex flex-row gap-4">
                {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imageUrl} alt="" style={{ width: 120, height: "auto" }} />
                ) : (
                    <div className="text-sm text-slate-400 flex items-center justify-center border border-dashed" style={{ width: 120, height: 120 }}>
                        Без фото
                    </div>
                )}
                <div className="flex flex-col flex-1 gap-2">
                    <textarea
                        className="border p-2 font-serif"
                        rows={10}
                        aria-label="Текст поста"
                        disabled={checking || sending}
                        value={text}
                        onChange={(e) => {setText(e.target.value); setCheckResult(null);}}
                    />
                    <input
                        className="border p-1"
                        placeholder="URL картинки"
                        aria-label="URL картинки"
                        disabled={checking || sending}
                        value={imageUrl}
                        onChange={(e) => {setImageUrl(e.target.value); setCheckResult(null);}}
                    />
                    <input
                        className="border p-1"
                        placeholder="#хэштеги через пробел"
                        value={hashtags}
                        onChange={(e) => setHashtags(e.target.value)}
                    />
                </div>
            </div>

            <div className="rounded border p-2 text-sm" role="status" aria-live="polite">
                {checking ? <p>Проверяем без отправки в Telegram…</p> : checkResult ? (
                    <>
                        <p className={checkResult.status === "passed" ? "text-green-800 font-semibold" : "text-red-700 font-semibold"}>
                            {checkResult.status === "passed" ? "Предварительная проверка пройдена" : "Ошибка предварительной проверки"}
                        </p>
                        {checkResult.error && <p>{checkResult.error}</p>}
                        {checkResult.status === "passed" && <p>
                            {checkResult.photo ? `Фото: ${checkResult.photo.width} × ${checkResult.photo.height}, ${checkResult.photo.format.toUpperCase()}, ${Math.ceil(checkResult.photo.bytes / 1024)} КБ.` : "Без фотографии — будет отправлен текст."}
                            {` Текст: ${checkResult.textLength} знаков.`}
                            {checkResult.shortened && " Подпись будет сокращена со ссылкой на полный текст."}
                            {" Права бота проверены."}
                        </p>}
                        <p className="text-slate-500">Проверено {new Date(checkResult.checkedAt).toLocaleString("ru-RU", {timeZone: "Europe/Moscow"})} МСК.</p>
                    </>
                ) : <p>Пост ещё не проверен или изменён после проверки.</p>}
                <p className="text-slate-500">Проверка ничего не публикует и не меняет расписание. Окончательное принятие фото Telegram подтвердит при отправке.</p>
            </div>
            <div className="flex flex-row flex-wrap items-center gap-2">
                <button className="border px-2 py-1 bg-sky-50" disabled={checking || sending || saving} onClick={onCheck}>
                    {checking ? "Проверяем…" : "Проверить без отправки"}
                </button>
                <button className="border px-2 py-1" disabled={saving || checking || sending} onClick={onSave}>
                    Сохранить
                </button>
                <button className="border px-2 py-1" disabled={checking || sending || saving} onClick={onToggleReady}>
                    {status === "ready" ? "Вернуть в черновики" : "Готово к отправке"}
                </button>
                <button className="border px-2 py-1 text-red-700" disabled={saving || checking || sending} onClick={onDelete}>
                    Удалить
                </button>
                <button
                    className="border px-2 py-1 bg-amber-100"
                    disabled={sending || checking || saving}
                    onClick={onSendNow}
                >
                    {sending ? "Отправляю…" : "Отправить сейчас"}
                </button>
                <label className="flex flex-row items-center gap-1 text-sm ml-4">
                    <input type="checkbox" checked={vkEnabled} onChange={onToggleVk} disabled />
                    Дублировать в VK (пока недоступно)
                </label>
            </div>
            {sendError && (
                <div className="text-red-700 text-sm">
                    Ошибка отправки: {sendError}
                </div>
            )}
        </div>
    );
};

export default PostItem;

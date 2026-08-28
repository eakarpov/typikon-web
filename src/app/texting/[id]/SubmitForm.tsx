'use client';

import {useCallback, useState} from "react";
import Link from "next/link";
import {useAppSelector} from "@/lib/hooks";

interface IPendingProposal {
    content: string;
    comment?: string;
}

const SubmitForm = ({ textId, pendingProposal }: { textId: string, pendingProposal: IPendingProposal | null }) => {
    const isAuthorized = useAppSelector(state => state.auth.isAuthorized);

    const [content, setContent] = useState("");
    const [comment, setComment] = useState("");
    const [sent, setSent] = useState(false);

    // Расстановка ударений по словарю собрания. Спорные места не трогаем: человек
    // сверяется со сканом и видит, как в книге, — угадывать за него незачем.
    // Прежний текст держим, чтобы правку можно было отменить одним нажатием.
    const [before, setBefore] = useState<string | null>(null);
    const [marking, setMarking] = useState(false);
    const [markNote, setMarkNote] = useState("");

    const onMarkAccents = useCallback(async () => {
        if (!content.trim()) return;
        setMarking(true);
        setMarkNote("");
        try {
            const res = await fetch("/api/accents/mark", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: content }),
            });
            const data = await res.json();
            if (!res.ok) { setMarkNote(data?.error || "Не удалось расставить"); return; }

            setBefore(content);
            setContent(data.tokens.map((token: { text: string }) => token.text).join(""));
            setMarkNote(
                `Расставлено ${data.marked} из ${data.expected}`
                + (data.ambiguous ? `, спорных ${data.ambiguous} оставлено без знака` : "")
                + (data.unknown ? `, незнакомых слов ${data.unknown}` : ""),
            );
        } catch {
            setMarkNote("Не удалось расставить: сеть не отвечает");
        } finally {
            setMarking(false);
        }
    }, [content]);

    const onUndoAccents = useCallback(() => {
        if (before === null) return;
        setContent(before);
        setBefore(null);
        setMarkNote("");
    }, [before]);

    const onSubmit = useCallback(() => {
        fetch("/api/texting", {
            method: "POST",
            body: JSON.stringify({ textId, content, comment }),
        }).then((res) => {
            if (res.ok) {
                setSent(true);
            } else {
                alert("Ошибка при отправке предложения!");
            }
        }).catch(() => {
            alert("Ошибка при отправке предложения!");
        });
    }, [textId, content, comment]);

    if (!isAuthorized) {
        return (
            <div className="mt-4 font-serif">
                <p>
                    Чтобы предложить свой вариант отекстовки, нужно&nbsp;
                    <Link href="/login" className="text-amber-800">
                        войти
                    </Link>.
                </p>
            </div>
        );
    }

    if (pendingProposal) {
        return (
            <div className="mt-4 font-serif">
                <p className="font-bold">
                    Ваше предложение на рассмотрении:
                </p>
                <p className="whitespace-pre-wrap">
                    {pendingProposal.content}
                </p>
                {pendingProposal.comment && (
                    <p className="text-stone-600">
                        Комментарий: {pendingProposal.comment}
                    </p>
                )}
            </div>
        );
    }

    if (sent) {
        return (
            <div className="mt-4 font-serif">
                <p>
                    Спасибо! Ваше предложение отправлено на рассмотрение администратору.
                </p>
            </div>
        );
    }

    return (
        <div className="mt-4 flex flex-col">
            <label className="font-serif">
                Ваш вариант текста
            </label>
            <textarea
                className="border-2 h-48"
                value={content}
                onChange={e => { setContent(e.target.value); setBefore(null); setMarkNote(""); }}
            />
            <div className="flex flex-row flex-wrap items-center gap-3 mt-1 font-serif text-sm">
                <button
                    type="button"
                    className="border rounded border-slate-300 px-2 py-0.5 disabled:opacity-50"
                    onClick={onMarkAccents}
                    disabled={marking || !content.trim()}
                >
                    {marking ? "Размечаю…" : "Расставить ударения"}
                </button>
                {before !== null && (
                    <button type="button" className="text-amber-800 underline underline-offset-4" onClick={onUndoAccents}>
                        Отменить
                    </button>
                )}
                {markNote && <span className="text-slate-600">{markNote}</span>}
                <Link href="/accents" className="text-slate-500 hover:underline ml-auto">
                    По словарю собрания
                </Link>
            </div>
            <label className="font-serif mt-2">
                Комментарий (необязательно)
            </label>
            <textarea
                className="border-2"
                value={comment}
                onChange={e => setComment(e.target.value)}
            />
            <button
                className="mt-2 border-2 w-fit px-2 disabled:opacity-50"
                onClick={onSubmit}
                disabled={!content.trim()}
            >
                Отправить предложение
            </button>
        </div>
    );
};

export default SubmitForm;

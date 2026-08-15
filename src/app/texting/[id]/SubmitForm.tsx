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
                onChange={e => setContent(e.target.value)}
            />
            <label className="font-serif">
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

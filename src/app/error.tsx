'use client';
import { useEffect } from "react";
import Link from "next/link";

// Граница ошибок для страниц. Без неё пользователь видел стандартную страницу Next,
// а сама ошибка не доезжала до сервера — узнать о ней было неоткуда.
const ErrorBoundary = ({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) => {
    useEffect(() => {
        fetch("/api/client-errors", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: error.name,
                message: error.message,
                stack: error.stack,
                digest: error.digest,
                where: typeof window !== "undefined" ? window.location.pathname : "",
            }),
            keepalive: true,
        }).catch(() => {
            // Если не доехало — не мешаем пользователю ещё одной ошибкой.
        });
    }, [error]);

    return (
        <div className="flex flex-col gap-3 pt-6">
            <h1 className="text-xl font-bold font-serif">Что-то сломалось</h1>
            <p className="font-serif">
                Страница не открылась. О сбое уже сообщено — попробуйте обновить.
            </p>
            <div className="flex flex-row gap-4">
                <button
                    type="button"
                    onClick={reset}
                    className="font-serif text-amber-800 underline underline-offset-4"
                >
                    Попробовать снова
                </button>
                <Link href="/" className="font-serif text-amber-800 underline underline-offset-4">
                    На главную
                </Link>
            </div>
        </div>
    );
};

export default ErrorBoundary;

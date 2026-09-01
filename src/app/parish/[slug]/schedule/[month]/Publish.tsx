"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

// «Этот месяц готов» — и обратно. Кнопка видна только тому, кто ведёт храм.
export const Publish = ({ slug, month, published, drifted }: {
    slug: string; month: string; published: string | null; drifted: string[];
}) => {
    const router = useRouter();
    const [pending, start] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const call = (unpublish: boolean) => start(async () => {
        setError(null);
        const r = await fetch(`/api/parish/${slug}/publish`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ month, unpublish }),
        });
        if (!r.ok) setError((await r.json().catch(() => ({}))).error ?? "не вышло");
        router.refresh();
    });

    return (
        <div style={{ margin: ".75rem 0", padding: ".6rem .75rem",
                      background: published ? "#f2f7f2" : "#f7f7f7",
                      fontSize: ".88rem" }}>
            {published ? (
                <>
                    <b>Опубликовано</b> {new Date(published).toLocaleDateString("ru-RU")} —
                    прихожане видят этот лист.{" "}
                    <button type="button" disabled={pending} onClick={() => call(false)}
                            style={{ color: "#1c5a8a" }}>
                        обновить лист
                    </button>
                    {" · "}
                    <button type="button" disabled={pending} onClick={() => call(true)}
                            style={{ color: "#8a1c1c" }}>
                        снять
                    </button>
                    {/* РАСХОЖДЕНИЕ ПОКАЗЫВАЕТСЯ, А НЕ ПРИМЕНЯЕТСЯ: лист на стене
                        висит, пока его не заменят, — и заменяет его ответственный */}
                    {drifted.length > 0 && (
                        <div style={{ marginTop: ".4rem", color: "#8a6d1c" }}>
                            Устав с тех пор передумал о{" "}
                            {drifted.length === 1 ? "числе" : "числах"}{" "}
                            {/* длинный список читать некому: правка правила
                                задевает разом весь месяц, и важно тут не
                                перечисление, а сколько их */}
                            {drifted.slice(0, 8).map(d => Number(d.slice(8))).join(", ")}
                            {drifted.length > 8 && ` и ещё ${drifted.length - 8}`}.
                            На стенде висит прежнее — обновите лист, если согласны.
                        </div>
                    )}
                </>
            ) : (
                <>
                    <b>Черновик.</b> Прихожане видят его с оговоркой, что это проект.{" "}
                    <button type="button" disabled={pending} onClick={() => call(false)}
                            style={{ color: "#1c5a8a" }}>
                        этот месяц готов
                    </button>
                </>
            )}
            {error && <div style={{ color: "#8a1c1c", marginTop: ".3rem" }}>{error}</div>}
        </div>
    );
};

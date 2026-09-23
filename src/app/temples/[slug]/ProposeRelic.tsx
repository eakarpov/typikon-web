"use client";
import { useState } from "react";
import RelicForm from "@/app/components/RelicForm";

// Предложить святыню этого храма. Запись уходит на разбор и до решения не
// видна: источник проверяет человек. Храм задан страницей.
const ProposeRelic = ({ slug }: { slug: string }) => {
    const [open, setOpen] = useState(false);
    const [done, setDone] = useState(false);

    if (done) {
        return <p className="font-serif text-sm text-slate-600">Спасибо: запись ушла на разбор и появится здесь, когда её примут.</p>;
    }
    return (
        <div className="font-serif text-sm">
            <button type="button" className="text-amber-800 hover:underline" onClick={() => setOpen(!open)}>
                {open ? "Закрыть" : "Предложить святыню этого храма"}
            </button>
            {open && (
                <div className="mt-2">
                    <p className="text-slate-600 mb-2">
                        Нужен источник: новость на сайте храма с датой, книга или иная страница. Для ковчега,
                        принесённого на время, укажите дни пребывания.
                    </p>
                    <RelicForm fixedTemple={slug} submitLabel="Отправить на разбор" onSubmit={async (relic) => {
                        const res = await fetch("/api/relics/propose", {
                            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(relic),
                        });
                        if (res.ok) { setDone(true); return null; }
                        const json = await res.json().catch(() => null);
                        return json?.errors ?? [`ошибка ${res.status}`];
                    }} />
                </div>
            )}
        </div>
    );
};

export default ProposeRelic;

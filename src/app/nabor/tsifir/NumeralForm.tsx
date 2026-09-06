'use client';
import { useState } from "react";
import { csNumeral, toCyrillicNumeral } from "@/lib/csEncoding/numerals";

// Цифирь в обе стороны. Считается на клиенте: таблица на тридцать букв, ходить
// за нею на сервер незачем.
//
// Сторона выбирается по самому вводу, а не переключателем: «19» и «ѳ҃і» ни при
// каких условиях друг с другом не спутать, и лишний переключатель тут был бы
// вопросом, ответ на который виден и так.

const MAX_VALUE = 999_999;

const answerOf = (raw: string): { text: string; note: string } | { error: string } | null => {
    const input = raw.trim();
    if (!input) return null;

    // И буквы, и цифры разом — не «переведём то, что узнали», а вопрос без
    // ответа: снисходительное чтение молча выбросило бы цифры и выдало число
    // букв за перевод всей строки.
    if (/\d/.test(input) && /[\u0400-\u04ff\u2de0-\u2dff\ua640-\ua69f]/.test(input)) {
        return { error: "В строке и буквы, и цифры — непонятно, что переводить. Оставьте одно." };
    }

    if (/^\d[\d\s]*$/.test(input)) {
        const value = Number(input.replace(/\s+/g, ""));
        if (!value) return { error: "Нуля в цифири нет: счёт начинается с единицы." };
        if (value > MAX_VALUE) {
            return { error: `Больше ${MAX_VALUE.toLocaleString("ru")} не пишем: дальше идут тьмы, легионы и леодры — счёт, который записывается не так.` };
        }
        return {
            text: toCyrillicNumeral(value),
            note: "Титло стоит над второй буквой с конца, как на титульных листах книг.",
        };
    }

    // Читаем снисходительно и со знаком тысячи: сюда вставляют кусок подписи,
    // а не выверенный токен.
    const value = csNumeral(input, { thousands: true, sign: "marks" });
    if (value === null) {
        return {
            error: /[҃҄҆҇҂]/.test(input)
                ? "Пометы стоят, а знакомых цифирных букв нет."
                : "Это не цифирь: нет ни титла, ни знака тысячи. Без пометы «ми» — предлог, а не 48.",
        };
    }
    return { text: String(value), note: "Число — сумма букв; во втором десятке единица пишется перед десяткой." };
};

const NumeralForm = () => {
    const [input, setInput] = useState("");
    const answer = answerOf(input);

    return (
        <div className="flex flex-col gap-2">
            <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="ѳ҃і или 19"
                aria-label="Цифирь или число"
                className="font-serif font-sans-serif border border-slate-300 rounded p-2 w-full max-w-sm text-lg"
            />
            {answer && ("error" in answer ? (
                <p className="font-serif text-sm text-slate-600">{answer.error}</p>
            ) : (
                <div>
                    <p className="font-serif font-sans-serif text-2xl">{answer.text}</p>
                    <p className="font-serif text-sm text-slate-500 mt-1">{answer.note}</p>
                </div>
            ))}
        </div>
    );
};

export default NumeralForm;

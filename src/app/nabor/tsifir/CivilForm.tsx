'use client';
import { useState } from "react";
import { normalizeChurchSlavonic } from "@/utils/churchSlavonic";

// Церковнославянское начертание в гражданское.
//
// Это та самая нормализация, которой у нас сличаются написания при поиске
// (@/utils/churchSlavonic): 305 текстов собрания набраны собственно ЦС-графикой,
// прочие гражданкой, и без сведения они не находятся друг по другу. Наружу она
// до сих пор не выходила, хотя сама по себе нужна: с гражданкой умеет работать
// всё — от поиска до озвучки, — а с ѣ и ꙋ почти ничто.

const MAX_LENGTH = 20_000;

const CivilForm = () => {
    const [text, setText] = useState("");
    const [copied, setCopied] = useState(false);
    const out = text ? normalizeChurchSlavonic(text) : "";

    return (
        <div className="flex flex-col gap-2">
            <textarea
                rows={4}
                value={text}
                onChange={(e) => { setText(e.target.value.slice(0, MAX_LENGTH)); setCopied(false); }}
                placeholder="Прїиди́те, поклони́мсѧ Царе́ви на́шемꙋ Бг҃ꙋ"
                aria-label="Церковнославянский текст"
                className="font-serif font-sans-serif border border-slate-300 rounded p-2 w-full"
            />
            {out && (
                <div>
                    <p className="font-serif text-slate-800">{out}</p>
                    <button
                        type="button"
                        onClick={() => navigator.clipboard?.writeText(out).then(() => setCopied(true))}
                        className="font-serif text-sm border border-slate-300 rounded px-3 py-1 mt-2 bg-slate-50 hover:bg-slate-100"
                    >
                        {copied ? "Скопировано" : "Скопировать"}
                    </button>
                </div>
            )}
            {/* Оговорка стоит здесь, а не под заголовком: она про то, чего в
                ответе нет, и читается она вместе с ответом. */}
            <p className="font-serif text-sm text-slate-500">
                Надстрочные знаки снимаются все, титла не раскрываются: «бг҃ъ» станет «бгъ»,
                а не «богъ». Раскрыть титло значит вернуть выброшенные буквы, а их не
                восстановить — «бга» ложится и в «бога», и в «бега».
            </p>
        </div>
    );
};

export default CivilForm;

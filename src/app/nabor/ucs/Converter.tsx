'use client';
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
// @ts-ignore — у file-saver нет типов; так же он подключён в components/save/TextSave.
import { saveAs } from "file-saver";
import { alreadyUnicode, convertBytes, report, SOURCE_LABELS, type Source } from "@/lib/csEncoding/core";
import { ALPHABETS, alphabetOf, type AlphabetId } from "@/lib/csEncoding/alphabets";
import { guess } from "@/lib/csEncoding/detect";
import { encodeText, withCrlf, MIME, OUT_LABELS, OUT_NOTES, type OutEncoding } from "@/lib/csEncoding/download";

// Окно перекодировки. Считается ЗДЕСЬ, в браузере, и это обещание напечатано
// на самой странице.
//
// ⚠️ Всякий fetch, добавленный в этот файл, делает ту строку ложью — и правится
// тогда сперва страница, а уже потом код. Обещано не из вежливости: чужой набор
// в UCS — часто неизданная работа, и отправлять её нам незачем. Считать тут
// нечего: таблица на 256 записей и цикл, никакой базы за спиной (в отличие от
// /razbor и /accents, которые ходят в собрание и оттого живут ручками).

/** Больше книги. Целая Ифика — 600 КБ, «Алфавит духовный» — 300 КБ. */
const MAX_BYTES = 5 * 1024 * 1024;

const hasCrlf = (bytes: Uint8Array) => {
    for (let i = 1; i < bytes.length; i++) {
        if (bytes[i - 1] === 0x0d && bytes[i] === 0x0a) return true;
    }
    return false;
};

const Converter = () => {
    const [mode, setMode] = useState<"file" | "paste">("file");
    const [bytes, setBytes] = useState<Uint8Array | null>(null);
    const [fileName, setFileName] = useState("");
    const [fileError, setFileError] = useState("");
    const [pasted, setPasted] = useState("");
    const [alphabet, setAlphabet] = useState<AlphabetId>("cp1251");
    const [chosen, setChosen] = useState<Source | null>(null);
    const [encoding, setEncoding] = useState<OutEncoding>("utf-8-bom");
    const [crlf, setCrlf] = useState<boolean | null>(null);
    const [copied, setCopied] = useState(false);
    const fileInput = useRef<HTMLInputElement>(null);

    // Вставка возвращается к байтам обращением того декодера, через который она
    // уже прошла; файл отдаёт байты сам.
    const source = useMemo(() => {
        if (mode === "file") return { bytes, lost: 0 };
        if (!pasted) return { bytes: null, lost: 0 };
        const { bytes: got, unknown } = alphabetOf(alphabet).toBytes(pasted);
        return { bytes: got, lost: unknown };
    }, [mode, bytes, pasted, alphabet]);

    const guesses = useMemo(
        () => (source.bytes && source.bytes.length ? guess(source.bytes) : []),
        [source.bytes],
    );
    const kind: Source = chosen ?? guesses[0]?.source ?? "ucs";

    // Отказ проверяется и на файле: юникодный текст, положенный сюда по ошибке,
    // портится ровно так же, как вставленный.
    const refuse = useMemo(() => {
        if (mode === "paste") return pasted.length > 0 && alreadyUnicode(pasted);
        if (!bytes) return false;
        return alreadyUnicode(new TextDecoder("utf-8").decode(bytes.slice(0, 20_000)));
    }, [mode, pasted, bytes]);

    const result = useMemo(() => {
        if (!source.bytes || !source.bytes.length || refuse) return null;
        return convertBytes(source.bytes, kind);
    }, [source.bytes, kind, refuse]);

    const useCrlf = crlf ?? (source.bytes ? hasCrlf(source.bytes) : false);
    const text = result ? (useCrlf ? withCrlf(result.text) : result.text) : "";

    const onFile = (file: File | undefined) => {
        setFileError("");
        if (!file) return;
        if (file.size > MAX_BYTES) {
            setFileError(`Файл превышает пять мегабайт (${(file.size / 1024 / 1024).toFixed(1)} МБ) `
                + "— объём, превосходящий целую книгу.");
            return;
        }
        file.arrayBuffer().then((buffer) => {
            setBytes(new Uint8Array(buffer));
            setFileName(file.name.replace(/\.[^.]+$/, ""));
            setChosen(null);
            setCrlf(null);
        });
    };

    const download = () => {
        const data = encodeText(text, encoding);
        // Копия в обычный ArrayBuffer: у Blob в типах TS нет места для
        // ArrayBufferLike, каким приходит Uint8Array из subarray.
        saveAs(new Blob([data.slice().buffer as ArrayBuffer], { type: MIME[encoding] }),
            `${fileName || "perekodirovka"}-unicode.txt`);
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex gap-2">
                {(["file", "paste"] as const).map((m) => (
                    <button
                        key={m}
                        type="button"
                        aria-pressed={mode === m}
                        onClick={() => { setMode(m); setChosen(null); setCrlf(null); }}
                        className={`font-serif border rounded px-3 py-1 ${mode === m
                            ? "border-slate-500 bg-slate-100" : "border-slate-300 bg-white hover:bg-slate-50"}`}
                    >
                        {m === "file" ? "Файл" : "Вставить текст"}
                    </button>
                ))}
            </div>

            {mode === "file" ? (
                <div className="flex flex-col gap-1">
                    <input
                        ref={fileInput}
                        type="file"
                        aria-label="Файл со старым набором"
                        onChange={(e) => onFile(e.target.files?.[0])}
                        className="font-serif text-sm"
                    />
                    <p className="font-serif text-xs text-slate-500">
                        Байты читаются без промежуточных преобразований: ничего не
                        утрачено по пути, и разбору доступно всё содержимое файла.
                    </p>
                    {fileError && <p className="font-serif text-sm text-red-700">{fileError}</p>}
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    <textarea
                        rows={5}
                        value={pasted}
                        onChange={(e) => { setPasted(e.target.value); setChosen(null); setCopied(false); }}
                        placeholder="Вставьте текст, который отображается неверно"
                        aria-label="Вставленный текст"
                        className="font-serif border border-slate-300 rounded p-2 w-full"
                    />
                    <label className="font-serif text-sm text-slate-700">
                        Чем его прочёл браузер:{" "}
                        <select
                            value={alphabet}
                            onChange={(e) => setAlphabet(e.target.value as AlphabetId)}
                            className="border border-slate-300 rounded px-2 py-1"
                        >
                            {ALPHABETS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                        </select>
                    </label>
                    <p className="font-serif text-xs text-slate-500">
                        {alphabetOf(alphabet).note}
                    </p>
                    {source.lost > 0 && !refuse && (
                        <p className="font-serif text-sm text-amber-700">
                            {source.lost.toLocaleString("ru")} знаков утрачено до передачи текста
                            сюда: этим байтам не нашлось соответствия в кодовой странице браузера.
                            Вставка их не восстанавливает — требуется исходный файл.
                        </p>
                    )}
                </div>
            )}

            {refuse && (
                <div className="border-l-2 border-amber-300 pl-3 py-1">
                    <p className="font-serif text-slate-800">
                        <strong>Текст уже представлен в юникоде.</strong> В нём присутствуют
                        титла, звательца или выносные буквы — знаки, отсутствующие в
                        дореформенном наборе.
                    </p>
                    <p className="font-serif text-sm text-slate-600 mt-1">
                        Повторное преобразование исказило бы его необратимо и потому не
                        выполняется. Если текст отображается неверно, причина не в кодировке:
                        см. <Link href="/nabor/znaki" className="text-red-900 hover:underline">
                            разбор по знакам</Link> или <Link href="/nabor/shrift"
                            className="text-red-900 hover:underline">проверку шрифта</Link>.
                    </p>
                </div>
            )}

            {guesses.length > 0 && !refuse && (
                <div className="flex flex-col gap-1">
                    <label className="font-serif text-sm text-slate-700">
                        Чем набран исходник:{" "}
                        <select
                            value={kind}
                            onChange={(e) => setChosen(e.target.value as Source)}
                            className="border border-slate-300 rounded px-2 py-1"
                        >
                            {guesses.map((g) => (
                                <option key={g.source} value={g.source}>{SOURCE_LABELS[g.source]}</option>
                            ))}
                        </select>
                        {chosen === null && <span className="text-slate-500"> — предположение</span>}
                    </label>
                    {/* Догадка показывается уликами, а не долей уверенности:
                        доля — это наше внутреннее число, а улики читатель может
                        проверить сам. */}
                    <ul className="font-serif text-xs text-slate-500 list-disc pl-5">
                        {(guesses.find((g) => g.source === kind) ?? guesses[0]).evidence.map((e) => (
                            <li key={e}>{e}</li>
                        ))}
                    </ul>
                </div>
            )}

            {result && (
                <div className="flex flex-col gap-3">
                    <div>
                        <h3 className="font-serif font-bold text-sm mb-1">Вышло</h3>
                        <div className="font-serif font-sans-serif border border-slate-200 rounded p-2
                                        max-h-80 overflow-auto whitespace-pre-wrap text-lg">
                            {result.text.slice(0, 20_000)}
                            {result.text.length > 20_000 && (
                                <span className="text-slate-400 text-sm font-serif">
                                    {"\n\n"}…показаны первые 20 000 знаков из {result.text.length.toLocaleString("ru")}.
                                    Целиком — файлом.
                                </span>
                            )}
                        </div>
                    </div>

                    {report(result.stats).length > 0 && (
                        <p className="font-serif text-sm text-slate-600">
                            Сделано: {report(result.stats).join(", ")}.
                        </p>
                    )}
                    {result.footnotes.length > 0 && (
                        <p className="font-serif text-sm text-slate-600">
                            Извлечено сносок: {result.footnotes.length}. В тексте они обозначены
                            номерами в фигурных скобках, а содержание вынесено отдельно — так они
                            и записаны в HIP.
                        </p>
                    )}
                    {result.dropped.length > 0 && (
                        <p className="font-serif text-sm text-slate-600">
                            Извлечено из шапки издания: «{result.dropped[0].slice(0, 80)}…».
                            Это не текст книги, а сведения об оцифровке; они вынесены из текста,
                            но не утрачены и приведены здесь.
                        </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => navigator.clipboard?.writeText(text).then(() => setCopied(true))}
                            className="font-serif border border-slate-300 rounded px-3 py-1 bg-slate-50 hover:bg-slate-100"
                        >
                            {copied ? "Скопировано" : "Скопировать"}
                        </button>
                        <select
                            value={encoding}
                            onChange={(e) => setEncoding(e.target.value as OutEncoding)}
                            aria-label="Кодировка файла"
                            className="font-serif border border-slate-300 rounded px-2 py-1"
                        >
                            {(Object.keys(OUT_LABELS) as OutEncoding[]).map((e) => (
                                <option key={e} value={e}>{OUT_LABELS[e]}</option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={download}
                            className="font-serif border border-slate-300 rounded px-3 py-1 bg-slate-50 hover:bg-slate-100"
                        >
                            Скачать файлом
                        </button>
                        <label className="font-serif text-sm text-slate-600 flex items-center gap-1">
                            <input type="checkbox" checked={useCrlf} onChange={(e) => setCrlf(e.target.checked)} />
                            переводы строк по-виндовски
                        </label>
                    </div>
                    <p className="font-serif text-xs text-slate-500">{OUT_NOTES[encoding]}</p>
                </div>
            )}
        </div>
    );
};

export default Converter;

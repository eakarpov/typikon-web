'use client';
import React, {useCallback, useEffect, useState, useRef} from "react";
import {
    applyValue,
    applyReadingValues,
    readingSource,
    READING_SOURCE_KEY,
    clearStored,
    COLOR_SCHEMES,
    defaultValues,
    READING_SETTINGS,
    ReadingSetting,
    ReadingValues,
    readStored,
    SETTING,
    storeValue,
} from "@/lib/settings/reading";
import {useAppSelector} from "@/lib/hooks";
import {sanitizeReadingValues} from "@/lib/settings/account";
import {myFont} from "@/utils/font";

// Образец — начало «Похвального слова на Пасху» из собрания: с ударениями и
// длинными периодами, то есть ровно то, что читателю и предстоит. Подбирать
// размер по строке «Пример текста» бессмысленно.
//
// Церковнославянский образец — своя строка: выбранный шрифт касается только
// таких текстов, и по гражданскому набору его не увидеть.
const SAMPLE = "На стра́жи мое́й ста́ну, глаго́лет чу́дный Авваку́м, и аз с ним днесь, "
    + "в да́нней ми от Ду́ха вла́сти, и виде́нии: и усмотрю́, и уве́м, что яви́тся, и что "
    + "возглаго́лется ми. И стах и усмотри́х, и се муж вше́д на о́блацех, и сей высо́к зело́: "
    + "и виде́ние его́, я́ко виде́ние а́нгела: и ри́за его́, я́ко свет мо́лния преходя́щаго.";

const CS_SAMPLE = "Гдⷭ҇и, воззва́хъ къ тебѣ̀, оу҆слы́ши мѧ̀ · ҂зсѻ҃в";

const Choice = ({ setting, value, onPick }: {
    setting: ReadingSetting;
    value: string;
    onPick: (setting: ReadingSetting, value: string) => void;
}) => (
    <div className="flex flex-col gap-1">
        <span className="font-serif">{setting.label}</span>
        {setting.hint && (
            <span className="font-serif text-sm text-slate-500">{setting.hint}</span>
        )}
        <div className="flex flex-row flex-wrap gap-2">
            {setting.options?.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    aria-pressed={value === option.value}
                    onClick={() => onPick(setting, option.value)}
                    className={`font-serif border rounded px-2 py-1 text-sm ${
                        value === option.value
                            ? "border-amber-800 text-amber-800 font-bold"
                            : "border-slate-300"
                    }`}
                >
                    {option.label}
                </button>
            ))}
        </div>
    </div>
);

const ReadingSettings = () => {
    // На сервере значений из localStorage нет, поэтому первый рендер — умолчания,
    // а прочитанное подставляется сразу после монтирования. Сами переменные к этому
    // моменту уже расставлены скриптом из layout, так что страница не мигает —
    // здесь только приводим в соответствие подписи и нажатые кнопки.
    const [values, setValues] = useState<ReadingValues>(defaultValues);

    const [source, setSource] = useState<"browser" | "account">("browser");
    const [message, setMessage] = useState("");
    const [busy, setBusy] = useState(false);
    const isAuthorized = useAppSelector(state => state.auth.isAuthorized);
    const current = useRef(defaultValues());
    const saveQueue = useRef(Promise.resolve());

    useEffect(() => {
        current.current = sanitizeReadingValues(readStored());
        setValues(current.current);
        setSource(readingSource());
    }, []);

    const saveAccount = useCallback((next: ReadingValues) => {
        setMessage("Сохраняю…");
        try { localStorage.setItem("typikon-account-reading", JSON.stringify(next)); } catch {}
        // Requests are serialized so an earlier colour change cannot overwrite a later one.
        saveQueue.current = saveQueue.current.then(async () => {
            const res = await fetch("/api/reading-settings", {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ values: next }),
            });
            if (!res.ok) throw new Error("Не удалось сохранить настройки в учётке");
            setMessage("Сохранено в учётке");
        }).catch(() => setMessage("Настройки не сохранены в учётке. Нажмите «Повторить сохранение»."));
    }, []);

    const changeSource = async (nextSource: "browser" | "account") => {
        setBusy(true);
        setMessage("");
        try {
            let next: ReadingValues;
            if (nextSource === "account") {
                const res = await fetch("/api/reading-settings", { cache: "no-store" });
                if (!res.ok) throw new Error("Для настроек учётки нужно войти");
                const data = await res.json();
                next = sanitizeReadingValues(data.values || current.current);
                if (!data.values) {
                    const saved = await fetch("/api/reading-settings", {
                        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ values: next }),
                    });
                    if (!saved.ok) throw new Error("Не удалось сохранить настройки в учётке");
                }
                localStorage.setItem("typikon-account-reading", JSON.stringify(next));
            } else {
                localStorage.setItem(READING_SOURCE_KEY, "browser");
                next = sanitizeReadingValues(readStored());
            }
            localStorage.setItem(READING_SOURCE_KEY, nextSource);
            setSource(nextSource);
            current.current = next;
            setValues(next);
            applyReadingValues(next);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Не удалось загрузить настройки");
        } finally { setBusy(false); }
    };

    const onPick = useCallback((setting: ReadingSetting, value: string) => {
        const next = { ...current.current, [setting.id]: value };
        current.current = next;
        setValues(next);
        applyValue(setting, value);
        if (readingSource() === "account") saveAccount(next);
        else storeValue(setting, value);
    }, [saveAccount]);

    const onScheme = useCallback((background: string, foreground: string) => {
        onPick(SETTING.background, background);
        onPick(SETTING.foreground, foreground);
    }, [onPick]);

    const onReset = useCallback(() => {
        const next = defaultValues();
        if (readingSource() === "account") saveAccount(next);
        else clearStored();
        current.current = next;
        setValues(next);
        applyReadingValues(next);
    }, [saveAccount]);

    const choices = READING_SETTINGS.filter((setting) => setting.options);

    return (
        <div className={`${myFont.variable} flex flex-col gap-5 mt-3`}>
            <p className="font-serif text-slate-500">
                Выберите, где хранить настройки. Настройки браузера сохраняются отдельно.
                При первом включении учётки в неё копируются текущие значения.
            </p>

            <label className="font-serif">
                Настройки отображения: {" "}
                <select value={source} disabled={busy} onChange={e => void changeSource(e.target.value as "browser" | "account")}>
                    <option value="browser">Из браузера</option>
                    <option value="account" disabled={!isAuthorized}>Из учётки{!isAuthorized ? " (нужен вход)" : ""}</option>
                </select>
            </label>
            {message && <p role="status">{message}</p>}
            {source === "account" && <button type="button" className="font-serif underline w-fit" onClick={() => saveAccount(current.current)}>Повторить сохранение</button>}

            {choices.map((setting) => (
                <Choice key={setting.id} setting={setting} value={values[setting.id]} onPick={onPick} />
            ))}

            <div className="flex flex-col gap-1">
                <span className="font-serif">Цвета</span>
                <div className="flex flex-row flex-wrap gap-2">
                    {COLOR_SCHEMES.map((scheme) => (
                        <button
                            key={scheme.id}
                            type="button"
                            aria-pressed={values.background === scheme.background && values.foreground === scheme.foreground}
                            onClick={() => onScheme(scheme.background, scheme.foreground)}
                            className={`font-serif border rounded px-2 py-1 text-sm ${
                                values.background === scheme.background && values.foreground === scheme.foreground
                                    ? "border-amber-800 font-bold"
                                    : "border-slate-300"
                            }`}
                            style={{ background: scheme.background, color: scheme.foreground }}
                        >
                            {scheme.label}
                        </button>
                    ))}
                </div>
                <p className="font-serif text-sm text-slate-500 mt-1">
                    Тёмная пара меняет фон и текст страницы и чтения. Всплывающие окна и приглушённые
                    подписи остаются светлыми — полноценной тёмной темы у сайта пока нет.
                </p>
                <div className="flex flex-row flex-wrap gap-4 mt-1">
                    <label className="font-serif text-sm flex flex-row items-center gap-2">
                        Свой фон
                        <input
                            type="color"
                            value={values.background}
                            onChange={(e) => onPick(SETTING.background, e.target.value)}
                        />
                    </label>
                    <label className="font-serif text-sm flex flex-row items-center gap-2">
                        Свой цвет текста
                        <input
                            type="color"
                            value={values.foreground}
                            onChange={(e) => onPick(SETTING.foreground, e.target.value)}
                        />
                    </label>
                </div>
            </div>

            {/* Образец собран теми же переменными, что и страница чтения, поэтому
                показывает ровно то, что получится, — включая ширину колонки. */}
            <div className="flex flex-col gap-1">
                <span className="font-serif">Как это будет выглядеть</span>
                <div className="reading-column border border-slate-300 rounded p-3">
                    <p className="reading-text font-serif text-justify text-lg whitespace-pre-wrap first-letter:text-red-600">
                        {SAMPLE}
                    </p>
                    {/* Церковнославянская строка отдельно: выбор шрифта иначе не
                        виден вовсе — гражданский образец набран не им. Взята
                        строка с выносной, покрытием, титлом и звательцем, то
                        есть ровно тем, чем шрифты и различаются. */}
                    <p className="reading-text font-sans-serif text-lg mt-2">
                        {CS_SAMPLE}
                    </p>
                </div>
            </div>

            <div>
                <button
                    type="button"
                    onClick={onReset}
                    className="font-serif border rounded border-slate-300 px-2 py-1 text-sm"
                >
                    Вернуть как было
                </button>
            </div>
        </div>
    );
};

export default ReadingSettings;

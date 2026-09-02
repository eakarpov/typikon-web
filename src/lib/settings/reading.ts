// Настройки чтения: размер, интервал, ширина колонки, выключка и цвета.
//
// Одно место на весь механизм — сюда смотрят и страница /settings, и скрипт,
// который применяет сохранённое до первой отрисовки. Значения живут в
// localStorage и раскладываются в CSS-переменные на <html>; сама раскраска
// и размеры описаны в src/styles/globals.css.
//
// Почему переменные, а не inline-стили на body, как было раньше: inline-стиль
// достаётся только самому body и не даёт зацепиться из CSS, поэтому прежние два
// пикера красили фон и текст, но не всплывающее меню и не образцы на странице
// настроек. Переменная же наследуется всем деревом и переопределяется в одном месте.
//
// Ключи хранения намеренно оставлены прежними: у тех, кто уже выбрал цвета,
// настройки должны пережить эту правку.

export interface ReadingOption {
    value: string;
    label: string;
    hint?: string;
}

export interface ReadingSetting {
    id: string;
    key: string;
    cssVar: string;
    label: string;
    hint?: string;
    fallback: string;
    // Список — переключатель, его отсутствие — свободное значение (цвет).
    options?: ReadingOption[];
}

export const READING_SETTINGS: ReadingSetting[] = [
    {
        // Переменная хранит КРАСКУ, а не флаг: «не помечать» — это
        // transparent, и слой гаснет без единой ветки в разметке и в CSS.
        id: "citations",
        key: "typikon-citations-layer",
        cssVar: "--citations-mark",
        label: "Отзвуки Писания",
        hint: "Слова песнопения, взятые из Библии, помечаются прямо в тексте. "
            + "Список стихов под песнопением остаётся в любом случае.",
        fallback: "#fde68a",
        options: [
            { value: "#fde68a", label: "Помечать" },
            { value: "transparent", label: "Не помечать" },
        ],
    },
    {
        id: "fontSize",
        key: "typikon-reading-font-size",
        cssVar: "--reading-font-size",
        label: "Размер текста",
        hint: "Касается самого чтения, не меню и не подписей.",
        fallback: "1.125rem",
        options: [
            { value: "1rem", label: "Мельче" },
            { value: "1.125rem", label: "Обычный" },
            { value: "1.3125rem", label: "Крупнее" },
            { value: "1.5rem", label: "Крупный" },
            { value: "1.75rem", label: "Очень крупный" },
        ],
    },
    {
        id: "lineHeight",
        key: "typikon-reading-line-height",
        cssVar: "--reading-line-height",
        label: "Междустрочный интервал",
        hint: "Церковнославянский набор с надстрочными знаками при тесных строках сливается.",
        fallback: "1.5",
        options: [
            { value: "1.35", label: "Плотно" },
            { value: "1.5", label: "Обычно" },
            { value: "1.8", label: "Просторно" },
            { value: "2.1", label: "Очень просторно" },
        ],
    },
    {
        id: "measure",
        key: "typikon-reading-measure",
        cssVar: "--reading-measure",
        label: "Ширина колонки",
        hint: "На широком экране строка во всю ширину заставляет глаз искать начало следующей.",
        fallback: "100%",
        options: [
            { value: "34rem", label: "Узкая" },
            { value: "46rem", label: "Средняя" },
            { value: "60rem", label: "Широкая" },
            { value: "100%", label: "Во всю ширину" },
        ],
    },
    {
        id: "align",
        key: "typikon-reading-align",
        cssVar: "--reading-align",
        label: "Выключка",
        hint: "Переносов у нас нет, поэтому выключка по ширине местами разгоняет пробелы.",
        fallback: "justify",
        options: [
            { value: "justify", label: "По ширине" },
            { value: "left", label: "По левому краю" },
        ],
    },
    {
        id: "background",
        key: "typikon-background-color",
        cssVar: "--page-bg",
        label: "Цвет фона",
        fallback: "#fcfaf2",
    },
    {
        id: "foreground",
        key: "typikon-font-color",
        cssVar: "--page-fg",
        label: "Цвет текста",
        fallback: "#1c1917",
    },
];

export const SETTING = Object.fromEntries(
    READING_SETTINGS.map((setting) => [setting.id, setting]),
) as Record<string, ReadingSetting>;

// Готовые пары фон/текст. Тёмная даётся как пара к остальным, но полноценной
// тёмной темы у сайта нет: у всплывающих окон и приглушённых подписей цвета
// свои, и их сюда не завести одной переменной — это отдельная работа.
export interface ColorScheme {
    id: string;
    label: string;
    background: string;
    foreground: string;
}

export const COLOR_SCHEMES: ColorScheme[] = [
    { id: "parchment", label: "Пергамент", background: "#fcfaf2", foreground: "#1c1917" },
    { id: "paper", label: "Белый", background: "#ffffff", foreground: "#111827" },
    { id: "sepia", label: "Сепия", background: "#f4ecd8", foreground: "#3b2f2f" },
    { id: "dark", label: "Тёмный", background: "#1c1917", foreground: "#e7e5e4" },
];

export type ReadingValues = Record<string, string>;

export const defaultValues = (): ReadingValues =>
    Object.fromEntries(READING_SETTINGS.map((setting) => [setting.id, setting.fallback]));

export const readStored = (): ReadingValues => {
    const values = defaultValues();
    if (typeof window === "undefined") return values;

    READING_SETTINGS.forEach((setting) => {
        try {
            const stored = window.localStorage.getItem(setting.key);
            if (stored) values[setting.id] = stored;
        } catch {
            // Приватный режим и запрет на хранилище — не повод падать: остаются значения по умолчанию.
        }
    });

    return values;
};

export const applyValue = (setting: ReadingSetting, value: string) => {
    document.documentElement.style.setProperty(setting.cssVar, value);
};

export const storeValue = (setting: ReadingSetting, value: string) => {
    try {
        window.localStorage.setItem(setting.key, value);
    } catch {
        // Не сохранилось — настройка всё равно действует до конца сеанса.
    }
};

export const clearStored = () => {
    READING_SETTINGS.forEach((setting) => {
        try {
            window.localStorage.removeItem(setting.key);
        } catch {
            // см. выше
        }
        document.documentElement.style.removeProperty(setting.cssVar);
    });
};

// Скрипт, который раскладывает сохранённое по переменным ДО первой отрисовки.
// Раньше это делал useEffect, то есть уже после гидратации: выбравший тёмный фон
// на каждой полной загрузке успевал увидеть светлую вспышку. Строка собирается из
// того же списка настроек, так что разъехаться с ним не может.
const BOOT_PAIRS = READING_SETTINGS.map((setting) => [setting.key, setting.cssVar]);

export const settingsBootScript =
    `(function(){try{var p=${JSON.stringify(BOOT_PAIRS)},r=document.documentElement,i,v;` +
    `for(i=0;i<p.length;i++){v=localStorage.getItem(p[i][0]);if(v)r.style.setProperty(p[i][1],v);}}catch(e){}})();`;

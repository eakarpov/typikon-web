'use client';
import { useEffect, useMemo, useRef, useState } from "react";

// Сборщик виджета: выбрал вид — увидел его же и получил готовый код.
//
// Предпросмотр — та самая рамка, что уедет на чужой сайт, а не картинка,
// похожая на неё: иначе всякое расхождение между показанным и вставленным
// обнаруживалось бы уже у прихода.

const SITE = "https://www.typikon.su";

const CLASS = "border rounded px-1 py-0.5 text-sm font-serif bg-white";

interface Options {
    theme: "light" | "dark" | "auto";
    title: string;
    memory: boolean;
    readings: boolean;
    only: "all" | "bible";
    links: boolean;
    height: number;
}

const query = (o: Options): string => {
    const parts = [o.memory ? "memory" : "", o.readings ? "readings" : ""].filter(Boolean);
    const params = new URLSearchParams();
    if (o.theme !== "light") params.set("theme", o.theme);
    if (o.title !== "Чтения дня") params.set("title", o.title || "0");
    if (parts.length !== 2) params.set("parts", parts.join(","));
    if (o.only !== "all") params.set("only", o.only);
    if (!o.links) params.set("links", "0");
    const q = params.toString();
    return q ? `?${q}` : "";
};

const snippetOf = (o: Options): string =>
    `<iframe src="${SITE}/embed/day${query(o)}"\n`
    + `        title="Чтения дня" loading="lazy"\n`
    + `        style="width:100%;height:${o.height}px;border:1px solid #e2e8f0;border-radius:6px"></iframe>\n`
    + `<script src="${SITE}/embed.js" async></script>`;

const Builder = () => {
    const [o, setO] = useState<Options>({
        theme: "light", title: "Чтения дня", memory: true, readings: true,
        only: "all", links: true, height: 260,
    });
    const [copied, setCopied] = useState(false);
    // Рамка сообщает свою высоту — ту же, что услышит embed.js на чужом сайте.
    // Показываем предпросмотр по ней: иначе он висел бы с полосой прокрутки и
    // выглядел бы сломанным ровно там, где должен убеждать.
    const [measured, setMeasured] = useState<number | null>(null);
    const frame = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        const onMessage = (event: MessageEvent) => {
            const data = event.data as { typikon?: string; height?: number };
            if (!data || data.typikon !== "height" || typeof data.height !== "number") return;
            if (frame.current && frame.current.contentWindow === event.source) {
                setMeasured(Math.max(40, data.height));
            }
        };
        window.addEventListener("message", onMessage);
        return () => window.removeEventListener("message", onMessage);
    }, []);

    const snippet = useMemo(() => snippetOf(o), [o]);
    const set = <K extends keyof Options>(key: K, value: Options[K]) =>
        setO(prev => ({ ...prev, [key]: value }));

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(snippet);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Буфер бывает закрыт правами браузера — код и так виден целиком,
            // и выделить его руками ничто не мешает.
            setCopied(false);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-x-6 gap-y-2 items-baseline font-serif text-sm">
                <label className="flex items-center gap-1">
                    вид:
                    <select className={CLASS} value={o.theme}
                            onChange={e => set("theme", e.target.value as Options["theme"])}>
                        <option value="light">светлый</option>
                        <option value="dark">тёмный</option>
                        <option value="auto">по настройке читателя</option>
                    </select>
                </label>
                <label className="flex items-center gap-1">
                    заголовок:
                    <input className={CLASS} value={o.title} placeholder="без заголовка"
                           onChange={e => set("title", e.target.value)} />
                </label>
                <label className="flex items-center gap-1">
                    <input type="checkbox" checked={o.memory}
                           onChange={e => set("memory", e.target.checked)} />
                    память дня
                </label>
                <label className="flex items-center gap-1">
                    <input type="checkbox" checked={o.readings}
                           onChange={e => set("readings", e.target.checked)} />
                    чтения
                </label>
                <label className="flex items-center gap-1">
                    <input type="checkbox" checked={o.only === "bible"}
                           onChange={e => set("only", e.target.checked ? "bible" : "all")} />
                    только из Писания
                </label>
                <label className="flex items-center gap-1">
                    <input type="checkbox" checked={o.links}
                           onChange={e => set("links", e.target.checked)} />
                    ссылки на тексты
                </label>
                <label className="flex items-center gap-1">
                    высота:
                    <input className={`${CLASS} w-16`} type="number" min={80} max={900} step={10}
                           value={o.height}
                           onChange={e => set("height", Number(e.target.value) || 260)} />
                    пикселей
                    {measured !== null && (
                        <span className="text-xs text-slate-500">
                            (сегодня содержимому нужно {measured})
                        </span>
                    )}
                </label>
            </div>

            <div>
                <p className="font-serif font-bold text-sm">Как это будет выглядеть</p>
                <iframe
                    // Предпросмотр смотрит на свой же сайт: на выкладке это тот
                    // самый адрес, что стоит в коде ниже.
                    ref={frame}
                    src={`/embed/day${query(o)}`}
                    title="Предпросмотр виджета"
                    scrolling={measured === null ? undefined : "no"}
                    style={{ width: "100%", maxWidth: 420, height: measured ?? o.height,
                             border: "1px solid #e2e8f0", borderRadius: 6 }}
                />
                <p className="text-xs text-slate-500 font-serif mt-1">
                    Предпросмотр подстроен по содержимому — так же, как это сделает embed.js на
                    вашем сайте. Без него рамка будет высотой в {o.height} пикселей.
                </p>
            </div>

            <div>
                <div className="flex gap-3 items-baseline">
                    <p className="font-serif font-bold text-sm">Код для вставки</p>
                    <button onClick={copy} className="text-xs text-red-900 font-serif hover:underline">
                        {copied ? "скопировано" : "скопировать"}
                    </button>
                </div>
                <pre className="text-xs bg-slate-50 border border-slate-200 rounded p-2 mt-1 overflow-x-auto">
                    {snippet}
                </pre>
                <p className="text-xs text-slate-500 font-serif mt-1">
                    Вторая строка необязательна: она подгоняет высоту рамки под содержимое.
                    Без неё рамка останется той высоты, что указана в теге.
                </p>
            </div>
        </div>
    );
};

export default Builder;

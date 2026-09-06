'use client';
import { useEffect, useState } from "react";
import { GROUPS, FAMILIES, verdictOf, VERDICT_LABELS, type Verdict } from "@/lib/csEncoding/coverage";

// Измерение производится растрами, а не ширинами.
//
// Ширина не годится: надстрочные знаки имеют нулевую ширину, и по ней они
// неотличимы от отсутствующих. Поэтому знак рисуется на холсте и сравнивается
// с заведомо отсутствующим (U+FFFF); различие растров означает, что глиф есть.
//
// Измерение проверяется само: рядом считается контрольная пара — заведомо
// различные «а» и «б». Если она даёт совпадение, измерение недостоверно
// (getImageData в защищённом режиме возвращает искажённые данные), и выносится
// «проверить не удалось». Ложное утверждение об отсутствии знака хуже
// отсутствия проверки.

const SIZE = 48;

const raster = (ctx: CanvasRenderingContext2D, text: string, family: string): string => {
    ctx.clearRect(0, 0, SIZE * 3, SIZE * 2);
    ctx.font = `${SIZE}px ${family}`;
    ctx.fillText(text, 2, SIZE);
    const data = ctx.getImageData(0, 0, SIZE * 3, SIZE * 2).data;
    // Достаточно отпечатка, а не самих пикселей: сравниваем только между собой.
    let hash = 0;
    for (let i = 0; i < data.length; i += 4) hash = (hash * 31 + data[i + 3]) | 0;
    return String(hash);
};

interface Result {
    text: string;
    verdict: Verdict;
}

const FontCheck = () => {
    const [family, setFamily] = useState("serif");
    const [installed, setInstalled] = useState<Record<string, boolean>>({});
    const [results, setResults] = useState<Record<string, Result[]>>({});

    useEffect(() => {
        const canvas = document.createElement("canvas");
        canvas.width = SIZE * 3;
        canvas.height = SIZE * 2;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;

        const notdef = raster(ctx, "￿", family);
        // Контрольная пара: если «а» и «б» неразличимы, измерению верить нельзя.
        const controlPassed = raster(ctx, "а", family) !== raster(ctx, "б", family);

        const out: Record<string, Result[]> = {};
        for (const group of GROUPS) {
            out[group.name] = group.chars.map((text) => ({
                text,
                verdict: verdictOf({ differsFromNotdef: raster(ctx, text, family) !== notdef, controlPassed }),
            }));
        }
        setResults(out);

        // Наличие семейства определяется сравнением начертаний, а не
        // document.fonts.check: тот отвечает «да» и на заведомо несуществующее
        // имя (проверено), поскольку по спецификации сообщает лишь о том, что
        // строка может быть отрисована — хотя бы подстановочным шрифтом.
        //
        // Приём косвенный: одна и та же строка рисуется семейством с запасным
        // и одним запасным. Расхождение означает, что семейство участвовало в
        // отрисовке, то есть установлено. Совпадение по всем трём запасным
        // означает либо отсутствие семейства, либо полное совпадение
        // начертаний с запасным — случай редкий, но возможный, и потому
        // страница говорит «не найден», а не «не установлен».
        const probe = "ѣꙋѡдⷭа";
        const found: Record<string, boolean> = {};
        for (const name of FAMILIES) {
            found[name] = ["monospace", "serif", "sans-serif"].some(
                (base) => raster(ctx, probe, `"${name}", ${base}`) !== raster(ctx, probe, base),
            );
        }
        setInstalled(found);
    }, [family]);

    const missing = Object.values(results).flat().filter((r) => r.verdict === "missing");
    const unknown = Object.values(results).flat().some((r) => r.verdict === "unknown");

    return (
        <div className="flex flex-col gap-4">
            <label className="font-serif text-sm text-slate-700">
                Проверяемый шрифт:{" "}
                <select
                    value={family}
                    onChange={(e) => setFamily(e.target.value)}
                    className="border border-slate-300 rounded px-2 py-1"
                >
                    <option value="serif">системный с засечками (serif)</option>
                    <option value="sans-serif">системный без засечек (sans-serif)</option>
                    <option value="system-ui">системный интерфейсный (system-ui)</option>
                    {FAMILIES.map((f) => <option key={f} value={`"${f}"`}>{f}</option>)}
                </select>
            </label>

            {unknown ? (
                <p className="font-serif text-sm text-amber-700">
                    Измерение не состоялось: браузер отдаёт искажённые данные о нарисованном
                    (так поступают защищённые режимы). Проверить наличие знаков средствами
                    страницы в этих условиях нельзя, и утверждать их отсутствие мы не станем.
                </p>
            ) : (
                <p className="font-serif text-sm text-slate-700">
                    {missing.length === 0
                        ? "Все проверяемые знаки отображаются этим шрифтом."
                        : `Не отображается сочетаний: ${missing.length}. Ниже отмечены заполнителем.`}
                </p>
            )}

            {GROUPS.map((group) => (
                <section key={group.name}>
                    <h3 className="font-serif font-bold text-sm">{group.name}</h3>
                    <p className="font-serif text-xs text-slate-500 mb-1">{group.note}</p>
                    <ul className="flex flex-wrap gap-2">
                        {(results[group.name] ?? []).map((r) => (
                            <li
                                key={r.text}
                                title={VERDICT_LABELS[r.verdict]}
                                className={`border rounded px-2 py-1 text-2xl ${r.verdict === "missing"
                                    ? "border-amber-300 bg-amber-50"
                                    : r.verdict === "unknown" ? "border-slate-200 bg-slate-50" : "border-slate-200"}`}
                                style={{ fontFamily: family }}
                            >
                                {r.text}
                            </li>
                        ))}
                    </ul>
                </section>
            ))}

            <section>
                <h3 className="font-serif font-bold text-sm">Церковнославянские шрифты в системе</h3>
                <p className="font-serif text-xs text-slate-500 mb-1">
                    Определяется сравнением начертаний: строка рисуется семейством и без
                    него, и расхождение означает, что семейство участвовало в отрисовке.
                    Способ косвенный и о наличии отдельных знаков не свидетельствует.
                </p>
                <ul className="font-serif text-sm text-slate-700 flex flex-wrap gap-x-4">
                    {FAMILIES.map((f) => (
                        <li key={f}>
                            {f} — {installed[f] ? "найден" : "не найден"}
                        </li>
                    ))}
                </ul>
            </section>

            <div>
                <h3 className="font-serif font-bold text-sm">Тот же текст нашим шрифтом</h3>
                <p className="font-serif text-xs text-slate-500 mb-1">
                    Monomakh поставляется вместе с сайтом. Если строка читается здесь и не
                    читается в стороннем приложении, причина в шрифте этого приложения,
                    а не в кодировке текста.
                </p>
                <p className="font-serif font-sans-serif text-2xl">
                    Гдⷭ҇и, воззва́хъ къ тебѣ̀, оу҆слы́ши мѧ̀ · ҂зсѻ҃в
                </p>
            </div>
        </div>
    );
};

export default FontCheck;

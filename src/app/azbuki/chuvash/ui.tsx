import type { ReactNode } from "react";

// Мелочи оформления чувашской азбуки.
//
// Азбука набирается тем же семейством, что и прочие церковнославянские тексты
// портала: font-sans-serif у нас разрешается в --cs-font, то есть в выбранный
// читателем церковный шрифт, а без выбора — в Мономах. Обычной гарнитурой её
// не показать: в ней нет ни титла, ни ижицы, ни камор, и строка осыплется
// квадратами. Кегль крупнее — иначе надстрочные сливаются.

export const Cyr = ({ children }: { children: ReactNode }) => (
    <span className="font-sans-serif text-lg">{children}</span>
);

export const Chu = ({ children }: { children: ReactNode }) => (
    <span className="font-serif text-slate-600" lang="cv">{children}</span>
);

export const Table = ({ head, rows }: { head: string[]; rows: ReactNode[][] }) => (
    <div className="overflow-x-auto">
        <table className="font-serif text-sm border-collapse w-full">
            <thead>
                <tr className="border-b border-slate-300">
                    {head.map((h, i) => (
                        <th key={i} className="text-left font-normal text-slate-500 py-1 pr-4">{h}</th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {rows.map((row, i) => (
                    <tr key={i} className="border-b border-slate-100">
                        {row.map((cell, j) => (
                            <td key={j} className="py-1 pr-4 align-top">{cell}</td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

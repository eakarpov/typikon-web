'use client';
import type { ReactNode } from "react";

// Мелочи оформления, общие для трёх вкладок.
//
// Латиница и китайские знаки набираются разными гарнитурами и разным кеглем:
// написание — моноширинным, чтобы диакритика не съезжала, иероглиф — крупно,
// иначе черты сливаются.

export const Lat = ({ children, artificial, className = "" }: {
    children: ReactNode; artificial?: boolean; className?: string;
}) => (
    <span
        className={`font-mono ${artificial ? "text-slate-400" : ""} ${className}`}
        title={artificial ? "Написание назначено, а не выведено" : undefined}
    >
        {children}
    </span>
);

export const Han = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
    <span className={`font-serif ${className}`} lang="zh">{children}</span>
);

export const Faint = ({ children }: { children: ReactNode }) => (
    <span className="text-slate-500">{children}</span>
);

/** Строка таблицы. Ячейки передаются доводами, а не литералом массива:
    ключи им проставляет сама таблица на <td>, а eslint, видя массив JSX,
    этого не знает и требует key на каждой ячейке. */
export const row = (...cells: ReactNode[]): ReactNode[] => cells;

/** Таблица в стиле раздела: заголовок петитом, строки через тонкую линию. */
export const Table = ({ head, rows, caption }: {
    head: string[];
    rows: ReactNode[][];
    caption?: string;
}) => (
    <div className="overflow-x-auto">
        {caption && <p className="font-serif text-sm text-slate-500 mb-1">{caption}</p>}
        <table className="font-serif text-sm border-collapse w-full">
            <thead>
                <tr className="border-b border-slate-300">
                    {head.map((h, i) => (
                        <th key={i} className="text-left font-normal text-slate-500 py-1 pr-4 whitespace-nowrap">
                            {h}
                        </th>
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

/** Согласование существительного с числом: числа меняются при пересборке. */
export function plural(n: number, one: string, few: string, many: string) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
}

export const Loading = ({ what }: { what: string }) => (
    <p className="font-serif text-slate-500">Загружается {what}…</p>
);

export const Failed = ({ error }: { error: string }) => (
    <p className="font-serif text-red-800">
        Не удалось загрузить данные азбуки ({error}). Обновите страницу.
    </p>
);

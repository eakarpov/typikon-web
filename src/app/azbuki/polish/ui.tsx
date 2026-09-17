import type { ReactNode } from "react";

// Мелочи оформления польской азбуки. Кириллица набирается чуть крупнее
// латиницы: у ѣ, ѫ, ѩ и гачека мелкий кегль съедает различия.

export const Cyr = ({ children }: { children: ReactNode }) => (
    <span className="font-serif text-base">{children}</span>
);

export const Lat = ({ children }: { children: ReactNode }) => (
    <span className="font-serif italic text-slate-600" lang="pl">{children}</span>
);

export const Table = ({ head, rows }: { head: string[]; rows: ReactNode[][] }) => (
    <div className="overflow-x-auto">
        <table className="font-serif text-sm border-collapse w-full">
            <thead>
                <tr className="border-b border-slate-300">
                    {head.map((h, i) => (
                        <th key={i} className="text-left font-normal text-slate-500 py-1 pr-4">
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

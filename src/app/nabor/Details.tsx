import type { ReactNode } from "react";

// Подробности под значком: сведения, нужные не всякому.
//
// Страница остаётся серверной — раскрытие делает сам браузер тегом <details>,
// без единой строки на клиенте. Это не экономия ради экономии: раздел «Набор»
// нарочно лёгкий, и вешать на него клиентский компонент ради одной кнопки
// значило бы платить за неё на каждой странице раздела.

const Details = ({ summary, children }: { summary: string; children: ReactNode }) => (
    <details className="group">
        <summary
            className="inline-flex items-center gap-1 cursor-pointer list-none text-slate-500
                       hover:text-slate-700 marker:content-none"
            aria-label={summary}
        >
            <span
                aria-hidden
                className="inline-flex items-center justify-center w-4 h-4 rounded-full border
                           border-current text-[10px] leading-none font-sans"
            >
                i
            </span>
            <span className="underline decoration-dotted underline-offset-2">{summary}</span>
        </summary>
        <div className="font-serif text-sm text-slate-600 mt-2 pl-3 border-l border-slate-200">
            {children}
        </div>
    </details>
);

export default Details;

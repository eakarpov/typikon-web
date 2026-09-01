import Link from "next/link";

// Две вкладки обычными ссылками, без клиентского кода: страница и так вся на
// GET-запросах, и вкладка — такой же параметр адреса, как остальные. Значит её
// можно послать ссылкой вместе с набранным, а «назад» вернёт туда, где были.
//
// Набранное в чужой вкладке при переходе НЕ теряется: параметры переносятся
// целиком, меняется только tab. Иначе переключение туда-обратно стирало бы
// работу, а это худшее, что кнопка может сделать молча.

export type Tab = "calendars" | "solver";

const TABS: [Tab, string][] = [
    ["calendars", "Дата в календарях"],
    ["solver", "Разбор записи"],
];

const Tabs = ({ active, params }: { active: Tab; params: Record<string, string | undefined> }) => (
    <nav className="flex flex-row gap-1 border-b border-slate-300">
        {TABS.map(([tab, label]) => {
            const next = new URLSearchParams(
                Object.entries(params).filter(([key, value]) => key !== "tab" && value) as [string, string][]
            );
            next.set("tab", tab);
            const current = tab === active;
            return (
                <Link
                    key={tab}
                    href={`/chronology?${next}`}
                    aria-current={current ? "page" : undefined}
                    className={`font-serif px-3 py-1 -mb-px border-b-2 ${
                        current
                            ? "border-amber-800 text-amber-900 font-bold"
                            : "border-transparent text-slate-600 hover:text-slate-900"
                    }`}
                >
                    {label}
                </Link>
            );
        })}
    </nav>
);

export default Tabs;

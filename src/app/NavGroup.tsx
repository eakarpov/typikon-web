'use client';
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

// Выпадающая группа в шапке. Появилась, когда разделов стало больше, чем помещается
// в строку: «Собрание» собирает книги и песнопения, «Пособия» — то, что помогает
// читать (пока ударения, дальше словарь и родословная).
//
// Кнопка, а не div с onClick: иначе группу не открыть ни с клавиатуры, ни
// скринридером — а половина сайта как раз про доступность чтения.

export interface NavItem {
    href: string;
    label: string;
    /** Чем определяется подсветка, если адрес не совпадает с href буквально. */
    match?: string;
}

const NavGroup = ({ title, items }: { title: string; items: NavItem[] }) => {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const box = useRef<HTMLDivElement>(null);

    const active = items.some((item) => pathname?.includes(item.match ?? item.href));

    // Закрываем по щелчку мимо и по Esc — иначе список остаётся висеть поверх текста.
    useEffect(() => {
        if (!open) return;

        const onOutside = (event: MouseEvent) => {
            if (!box.current?.contains(event.target as Node)) setOpen(false);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
        };

        document.addEventListener("mousedown", onOutside);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onOutside);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const close = useCallback(() => setOpen(false), []);

    return (
        <div ref={box} className="relative min-w-fit">
            <button
                type="button"
                aria-expanded={open}
                aria-haspopup="true"
                onClick={() => setOpen(!open)}
                className={`cursor-pointer min-w-fit font-serif ${active ? "text-red-600" : ""}`}
            >
                {title}
                <span aria-hidden className="text-xs ml-0.5">▾</span>
            </button>
            {open && (
                <div className="absolute z-20 left-0 top-full mt-1 flex flex-col border border-slate-300 rounded bg-white shadow min-w-max py-1">
                    {items.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={close}
                            className={`font-serif px-3 py-1 hover:bg-amber-50 ${
                                pathname?.includes(item.match ?? item.href) ? "text-red-600" : ""
                            }`}
                        >
                            {item.label}
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
};

export default NavGroup;

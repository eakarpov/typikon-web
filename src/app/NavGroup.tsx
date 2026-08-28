'use client';
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";

// Выпадающая группа в шапке. Появилась, когда разделов стало больше, чем помещается
// в строку: «Собрание» собирает книги и песнопения, «Пособия» — то, что помогает
// читать (пока ударения, дальше словарь и родословная).
//
// Список рисуется ПОРТАЛОМ в body, а не рядом с кнопкой. Причина не в красоте:
// шапка — это <nav> с overflow-scroll (иначе на узком экране разделы не пролистать),
// высотой она в одну строку, и всё, что вылезает ниже, обрезается. Панель при этом
// исправно открывалась и даже отвечала скринридеру — просто её не было видно.
// Портал уносит её из-под обрезающего предка совсем, и следующая правка стилей
// шапки уже не сможет съесть её молча.
//
// Кнопка, а не div с onClick: иначе группу не открыть ни с клавиатуры, ни
// скринридером — а половина сайта как раз про доступность чтения.

export interface NavItem {
    href: string;
    label: string;
    /** Чем определяется подсветка, если адрес не совпадает с href буквально. */
    match?: string;
}

/** Отступ панели от кнопки и от края окна. */
const GAP = 4;
const EDGE = 8;

const NavGroup = ({ title, items }: { title: string; items: NavItem[] }) => {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const [at, setAt] = useState({ top: 0, left: 0 });
    const button = useRef<HTMLButtonElement>(null);
    const panel = useRef<HTMLDivElement>(null);

    const active = items.some((item) => pathname?.includes(item.match ?? item.href));

    // Ставит панель под кнопку. Если кнопку увезли из видимой части — закрываем:
    // висеть в пустоте ей незачем.
    const place = useCallback(() => {
        const rect = button.current?.getBoundingClientRect();
        if (!rect) return;

        const offscreen = rect.bottom < 0 || rect.top > window.innerHeight
            || rect.right < 0 || rect.left > window.innerWidth;
        if (offscreen) { setOpen(false); return; }

        setAt({ top: rect.bottom + GAP, left: rect.left });
    }, []);

    const toggle = useCallback(() => {
        setOpen((wasOpen) => {
            if (!wasOpen) place();
            return !wasOpen;
        });
    }, [place]);

    // Ширину панели заранее не знаем, поэтому прижимаем её к окну уже после
    // отрисовки. Прижим с обеих сторон: шапка прокручивается вбок, и кнопка
    // группы может оказаться у любого края.
    useLayoutEffect(() => {
        if (!open || !panel.current) return;
        const width = panel.current.offsetWidth;
        const max = Math.max(EDGE, window.innerWidth - width - EDGE);
        const fitted = Math.min(Math.max(at.left, EDGE), max);
        if (fitted !== at.left) setAt((old) => ({ ...old, left: fitted }));
    }, [open, at.left]);

    useEffect(() => {
        if (!open) return;

        const onOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            // Панель больше не потомок кнопки — проверяем обе части отдельно.
            if (button.current?.contains(target) || panel.current?.contains(target)) return;
            setOpen(false);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
        };
        // Панель привязана к окну, а не к кнопке, поэтому при прокрутке её надо
        // переставлять. Закрывать нельзя: щелчок по кнопке в прокручиваемой шапке
        // сам заставляет браузер подкрутить её в видимую часть, и панель схлопывалась
        // ровно в момент открытия — снаружи это выглядело как «кнопка не работает».
        // Слушаем с capture: прокрутка шапки не всплывает до window.
        document.addEventListener("mousedown", onOutside);
        document.addEventListener("keydown", onKey);
        window.addEventListener("scroll", place, true);
        window.addEventListener("resize", place);

        return () => {
            document.removeEventListener("mousedown", onOutside);
            document.removeEventListener("keydown", onKey);
            window.removeEventListener("scroll", place, true);
            window.removeEventListener("resize", place);
        };
    }, [open, place]);

    const close = useCallback(() => setOpen(false), []);

    return (
        <>
            <button
                ref={button}
                type="button"
                aria-expanded={open}
                aria-haspopup="true"
                onClick={toggle}
                className={`cursor-pointer min-w-fit font-serif ${active ? "text-red-600" : ""}`}
            >
                {title}
                <span aria-hidden className="text-xs ml-0.5">▾</span>
            </button>
            {/* open становится true только после гидратации, поэтому портал не
                расходится с тем, что отрисовал сервер. */}
            {open && createPortal(
                <div
                    ref={panel}
                    style={{ top: at.top, left: at.left }}
                    className="fixed z-50 flex flex-col border border-slate-300 rounded bg-white shadow min-w-max py-1"
                >
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
                </div>,
                document.body,
            )}
        </>
    );
};

export default NavGroup;

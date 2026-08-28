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

    // Ставит панель под кнопку в координатах СТРАНИЦЫ, а не окна. Шапка не липкая:
    // при прокрутке она уезжает вверх, и панель обязана уехать с ней. Привязка к
    // окну этого не даёт — панель повисала над текстом, и поправить это слушателем
    // прокрутки нельзя: события scroll здесь не приходят вовсе (проверено).
    const place = useCallback(() => {
        const rect = button.current?.getBoundingClientRect();
        if (!rect) return;

        setAt({
            top: rect.bottom + window.scrollY + GAP,
            left: rect.left + window.scrollX,
        });
    }, []);

    // Положение считаем ДО setOpen, а не внутри его апдейтера: апдейтер обязан быть
    // чистым, и setState из него React вправе отбросить. Отброшенный setAt оставил бы
    // панель в точке (0, 0) — под шапкой, где её не видно.
    const toggle = useCallback(() => {
        if (open) { setOpen(false); return; }
        place();
        setOpen(true);
    }, [open, place]);

    // Ширину панели заранее не знаем, поэтому прижимаем её к видимой части уже
    // после отрисовки. Прижим с обеих сторон: шапка прокручивается вбок, и кнопка
    // группы может оказаться у любого края.
    useLayoutEffect(() => {
        if (!open || !panel.current) return;
        const width = panel.current.offsetWidth;
        const min = window.scrollX + EDGE;
        const max = Math.max(min, window.scrollX + window.innerWidth - width - EDGE);
        const fitted = Math.min(Math.max(at.left, min), max);
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
        // Прокрутку не слушаем: панель стоит в координатах страницы и едет вместе
        // с ней сама. От изменения размера окна — переставляем.
        document.addEventListener("mousedown", onOutside);
        document.addEventListener("keydown", onKey);
        window.addEventListener("resize", place);

        return () => {
            document.removeEventListener("mousedown", onOutside);
            document.removeEventListener("keydown", onKey);
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
                    className="absolute z-50 flex flex-col border border-slate-300 rounded bg-white shadow min-w-max py-1"
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

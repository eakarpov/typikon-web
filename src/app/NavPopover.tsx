'use client';
import { ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Механика выпадающей панели в шапке, отделённая от того, что в ней лежит.
//
// Отделена, когда панелей стало две с разным содержимым: у групп разделов —
// ссылки, у выбора языка — переключатели. Мороки же в панели ровно столько,
// сколько её здесь, и повторять её второй раз было бы прямой ошибкой.
//
// Список рисуется ПОРТАЛОМ в body, а не рядом с кнопкой. Причина не в красоте:
// шапка — это <nav> с overflow-scroll (иначе на узком экране разделы не
// пролистать), высотой она в одну строку, и всё, что вылезает ниже, обрезается.
// Панель при этом исправно открывалась и даже отвечала скринридеру — просто её
// не было видно.
//
// Кнопка, а не div с onClick: иначе панель не открыть ни с клавиатуры, ни
// скринридером — а половина сайта как раз про доступность чтения.

/** Отступ панели от кнопки и от края окна. */
const GAP = 4;
const EDGE = 8;

interface Props {
    /** Что нарисовано на кнопке. */
    trigger: ReactNode;
    title?: string;
    /** Подсвечена ли кнопка: раздел панели открыт или язык не по умолчанию. */
    active?: boolean;
    className?: string;
    /** Содержимое панели. Закрыть её изнутри — через переданный close. */
    children: (close: () => void) => ReactNode;
}

const NavPopover = ({ trigger, title, active, className, children }: Props) => {
    const [open, setOpen] = useState(false);
    const [at, setAt] = useState({ top: 0, left: 0 });
    const button = useRef<HTMLButtonElement>(null);
    const panel = useRef<HTMLDivElement>(null);

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
    // может оказаться у любого края.
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
                title={title}
                aria-expanded={open}
                aria-haspopup="true"
                onClick={toggle}
                className={className ?? `cursor-pointer min-w-fit font-serif ${active ? "text-red-600" : ""}`}
            >
                {trigger}
            </button>
            {/* open становится true только после гидратации, поэтому портал не
                расходится с тем, что отрисовал сервер. */}
            {open && createPortal(
                <div
                    ref={panel}
                    style={{ top: at.top, left: at.left }}
                    className="absolute z-50 flex flex-col border border-slate-300 rounded bg-white shadow min-w-max py-1"
                >
                    {children(close)}
                </div>,
                document.body,
            )}
        </>
    );
};

export default NavPopover;

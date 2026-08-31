'use client';
import Link from "next/link";
import { usePathname } from "next/navigation";
import NavPopover from "@/app/NavPopover";

// Выпадающая группа разделов в шапке. Появилась, когда разделов стало больше,
// чем помещается в строку: «Собрание» собирает книги и песнопения, «Пособия» —
// то, что помогает читать.
//
// Сама механика панели живёт в NavPopover: тем же способом раскрывается выбор
// языка, и держать две её копии значило бы чинить всякую беду дважды.

export interface NavItem {
    href: string;
    label: string;
    /** Чем определяется подсветка, если адрес не совпадает с href буквально. */
    match?: string;
}

const NavGroup = ({ title, items }: { title: string; items: NavItem[] }) => {
    const pathname = usePathname();
    const active = items.some((item) => pathname?.includes(item.match ?? item.href));

    return (
        <NavPopover
            active={active}
            trigger={<>{title}<span aria-hidden className="text-xs ml-0.5">▾</span></>}
        >
            {(close) => items.map((item) => (
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
        </NavPopover>
    );
};

export default NavGroup;

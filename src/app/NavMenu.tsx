'use client';
import Link from "next/link";
import {Cog6ToothIcon, EnvelopeIcon, InformationCircleIcon, MagnifyingGlassIcon} from "@heroicons/react/20/solid";
import {usePathname} from "next/navigation";

const NavMenu = ({ showAdmin }: { showAdmin: boolean }) => {
    const pathname = usePathname();
    return (
        <div className="container mx-auto px-4 flex flex-row items-baseline">
            <Link href="/" className={`text-lg mr-3 font-bold min-w-fit font-serif ${pathname === `/` && `text-red-900`}`}>
                Уставные чтения
            </Link>
            <div className="flex flex-row space-x-4">
                <Link
                    href="/penticostarion"
                    className={`cursor-pointer min-w-fit font-serif ${pathname?.includes(`/penticostarion`) && `text-red-600`}`}
                >
                    Цветная триодь
                </Link>
                <Link
                    href="/triodion"
                    className={`cursor-pointer min-w-fit font-serif ${pathname?.includes(`/triodion`) && `text-red-600`}`}
                >
                    Постная триодь
                </Link>
                <Link
                    href="/rest-readings"
                    className={`cursor-pointer min-w-fit text-stone-400 font-serif ${pathname === `/rest-readings` && `text-red-400`}`}
                >
                    Вне триодного цикла
                </Link>
                <Link
                    href="/calendar"
                    className={`cursor-pointer min-w-fit font-serif ${(pathname?.includes(`/calendar`) || pathname?.includes(`/months`)) && `text-red-600`}`}
                >
                    Календарные чтения
                </Link>
                <Link
                    href="/calculator"
                    className={`cursor-pointer min-w-fit font-serif ${pathname === `/calculator` && `text-red-600`}`}
                >
                    Чтения на конкретный день
                </Link>
                <Link
                    href="/library"
                    className={`cursor-pointer min-w-fit font-serif ${pathname?.includes(`/library`) && `text-red-600`}`}
                >
                    Библиотека
                </Link>
                {showAdmin && (
                    <Link
                        href="/admin"
                          className={`cursor-pointer min-w-fit font-serif ${pathname?.includes(`/admin`) && `text-red-600`}`}
                    >
                        Админка
                    </Link>
                )}
                <Link
                    href="/search"
                    className={`cursor-pointer min-w-fit flex items-center ${pathname === `/search` && `text-red-600`}`}
                >
                    <MagnifyingGlassIcon className="w-4 h-4" />
                </Link>
                <Link
                    href="/contact"
                    className={`cursor-pointer min-w-fit flex items-center ${pathname === `/contact` && `text-red-600`}`}
                >
                    <EnvelopeIcon className="w-4 h-4" />
                </Link>
                <Link
                    href="/about"
                    className={`cursor-pointer min-w-fit flex items-center ${pathname === `/about` && `text-red-600`}`}
                >
                    <InformationCircleIcon className="w-4 h-4" />
                </Link>
                <Link
                    href="/settings"
                    className={`cursor-pointer min-w-fit flex items-center ${pathname === `/settings` && `text-red-600`}`}
                >
                    <Cog6ToothIcon className="w-4 h-4" />
                </Link>
            </div>
        </div>
    )
};

export default NavMenu;
